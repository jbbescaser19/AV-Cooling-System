import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";

import { staffAccountDeletionModel } from "../../../models/management/administration/staffAccountDeletionModel.js";

import { archiveModel } from "../../../models/management/archiveModel.js";

import { customerDeletionModel } from "../../../models/management/customers/customerDeletionModel.js";

import {
  validateCustomerDeletionId,
  validateCustomerDeletionConfirmation,
} from "../../../validators/management/customers/customerDeletionValidator.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

function ownerOnly(owner) {
  if (!owner?.id || owner.role !== "OWNER") {
    fail("Only the Owner can manage archived staff accounts.", 403);
  }
}

async function examine(db, owner, userId, lock) {
  const model = staffAccountDeletionModel(db);

  const staff = await model.findStaff(userId, lock);

  if (!staff) {
    fail("Staff account was not found or was already archived.", 404);
  }

  const blockers = [];

  if (Number(owner.id) === Number(userId)) {
    blockers.push("You cannot delete your own Owner account.");
  }

  if (staff.role === "OWNER") {
    blockers.push("Owner accounts cannot be deleted here.");
  }

  const activeJobs = await model.activeTechnicianWork(userId);

  if (activeJobs > 0) {
    blockers.push(
      `Reassign or finish ${activeJobs} active technician job(s) before deleting this account.`,
    );
  }

  return {
    staff,
    activeJobs,
    blockers,
    canDelete: blockers.length === 0,
  };
}

export async function staffDeletionPreview(owner, rawId) {
  ownerOnly(owner);

  const id = validateCustomerDeletionId(rawId);

  return examine(connectDB, owner, id, false);
}

export async function deleteStaffAccount(owner, rawId, raw) {
  ownerOnly(owner);

  const id = validateCustomerDeletionId(rawId);

  const { password } = validateCustomerDeletionConfirmation(raw);

  const ownerHash = await customerDeletionModel(connectDB).ownerPasswordHash(
    owner.id,
  );

  if (!ownerHash || !(await bcrypt.compare(password, ownerHash))) {
    fail("Owner password is incorrect. Staff account was not archived.", 403);
  }

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const check = await examine(db, owner, id, true);

    if (!check.canDelete) {
      fail(check.blockers.join(" "));
    }

    const model = staffAccountDeletionModel(db);

    const profiles = await model.technicianProfiles(id);

    await model.disableTechnician(id);

    await model.revokeSessions(id);

    // Disable access without destroying credentials.
    const result = await model.archiveStaff(id);

    if (result.affectedRows !== 1) {
      fail("Staff account changed. Refresh and retry.");
    }

    await model.audit(owner.id, id);

    await archiveModel(db).add({
      archiveId: randomUUID(),
      module: "staff-accounts",
      origin: "staff-accounts",
      id,
      label: check.staff.name,

      snapshot: {
        accountType: "STAFF",
        restorable: true,
        userId: id,
        previousRole: check.staff.role,
        originalStatus: check.staff.status,
        activeJobsAtDeletion: check.activeJobs,
        technicianProfiles: profiles.map((profile) => ({
          id: Number(profile.id),
          status: profile.status,
        })),
      },

      previousStatus: check.staff.status,
      staffId: owner.id,
    });

    await db.commit();

    return {
      message:
        "Staff account moved to Archive. It can be restored or permanently deleted.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

/**
 * Restore a staff account within an existing transaction.
 */
export async function restoreArchivedStaff(db, owner, entry) {
  ownerOnly(owner);

  const model = staffAccountDeletionModel(db);

  const snapshot = await model.archiveSnapshot(entry.id);

  if (snapshot?.restorable !== true) {
    fail(
      "This staff account was previously anonymized and cannot be restored.",
    );
  }

  const id = Number(entry.recordId);

  const account = await model.findArchivedStaff(id);

  if (
    !account ||
    account.status !== "INACTIVE" ||
    Number(snapshot.userId) !== id ||
    account.role !== snapshot.previousRole
  ) {
    fail("This archived staff account is no longer restorable.");
  }

  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(snapshot.originalStatus)) {
    fail("Invalid previous staff status.");
  }

  const profiles = await model.technicianProfiles(id);

  const savedProfiles = snapshot.technicianProfiles;

  if (!Array.isArray(savedProfiles)) {
    fail("Technician recovery information is unavailable.");
  }

  const archive = archiveModel(db);

  for (const profile of savedProfiles) {
    if (
      !["ACTIVE", "INACTIVE", "UNAVAILABLE"].includes(profile.status) ||
      !profiles.some((current) => Number(current.id) === Number(profile.id))
    ) {
      fail("A technician profile has changed or is missing.");
    }

    // Do not reactivate a separately archived profile.
    if (
      profile.status !== "INACTIVE" &&
      (await archive.isArchived("technicians", profile.id))
    ) {
      fail("Restore the separately archived technician profile first.");
    }
  }

  await model.revokeSessions(id);

  const result = await model.restoreStaff(id, snapshot.originalStatus);

  if (result.affectedRows !== 1) {
    fail("Unable to restore this staff account.");
  }

  for (const profile of savedProfiles) {
    await model.restoreTechnician(id, profile.id, profile.status);
  }
}

/**
 * Permanently anonymize an archived staff account.
 * Keep historical jobs, audit logs and payments.
 */
export async function purgeArchivedStaff(db, entry) {
  const model = staffAccountDeletionModel(db);

  const snapshot = await model.archiveSnapshot(entry.id);

  if (!snapshot) {
    fail("Staff archive information not found.");
  }

  // Old accounts were already anonymized.
  if (snapshot.restorable !== true) {
    return;
  }

  const id = Number(entry.recordId);

  const account = await model.findArchivedStaff(id);

  if (
    !account ||
    account.status !== "INACTIVE" ||
    Number(snapshot.userId) !== id ||
    account.role !== snapshot.previousRole
  ) {
    fail("This staff account is no longer safely deletable.");
  }

  if (await model.activeTechnicianWork(id)) {
    fail("Resolve active technician assignments first.");
  }

  await model.disableTechnician(id);
  await model.revokeSessions(id);

  const result = await model.purgeStaff(
    id,
    `deleted-staff-${id}@accounts.invalid`,
    randomBytes(48).toString("hex"),
  );

  if (result.affectedRows !== 1) {
    fail("Unable to permanently delete the staff account.");
  }

  await model.redactArchiveLabel(entry.id, id);
}
