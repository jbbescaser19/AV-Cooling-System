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
  if (!owner?.id || owner.role !== "OWNER")
    fail("Only the Owner can delete staff accounts.", 403);
}
async function examine(db, owner, userId, lock) {
  const model = staffAccountDeletionModel(db);
  const staff = await model.findStaff(userId, lock);
  if (!staff) fail("Staff account was not found or was already deleted.", 404);
  const blockers = [];
  if (Number(owner.id) === Number(userId))
    blockers.push("You cannot delete your own Owner account.");
  if (staff.role === "OWNER")
    blockers.push("Owner accounts cannot be deleted here.");
  const activeJobs = await model.activeTechnicianWork(userId);
  if (activeJobs > 0)
    blockers.push(
      `Reassign or finish ${activeJobs} active technician job(s) before deleting this account.`,
    );
  return { staff, activeJobs, blockers, canDelete: blockers.length === 0 };
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
    fail("Owner password is incorrect. Staff account was not deleted.", 403);
  }
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const check = await examine(db, owner, id, true);
    if (!check.canDelete) fail(check.blockers.join(" "));
    const model = staffAccountDeletionModel(db);
    await model.disableTechnician(id);
    await model.revokeSessions(id);
    const randomEmail = `deleted-staff-${id}@accounts.invalid`;
    const randomHash = randomBytes(48).toString("hex");
    const result = await model.closeStaff(id, randomEmail, randomHash);
    if (result.affectedRows !== 1)
      fail("Staff account changed. Refresh and retry.");
    await model.audit(owner.id, id);
    // Account closure and Archive entry commit together.
    await archiveModel(db).add({
      archiveId: randomUUID(),
      module: "staff-accounts",
      origin: "staff-accounts",
      id,
      label: `Deleted staff #${id}`,
      snapshot: {
        accountType: "STAFF",
        userId: id,
        previousRole: check.staff.role,
        originalStatus: check.staff.status,
        activeJobsAtDeletion: check.activeJobs,
      },
      previousStatus: check.staff.status,
      staffId: owner.id,
    });
    await db.commit();
    return {
      message:
        "Staff account moved to Archive and login revoked. Historical jobs, payments and audit records were preserved.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
