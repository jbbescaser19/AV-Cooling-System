import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { fail } from "../workspaceHelpers.js";
import { archiveModel } from "../../../models/management/archiveModel.js";
import { staffAccountDeletionModel } from "../../../models/management/administration/staffAccountDeletionModel.js";

function technicianCode(userId) {
  return `TECH-${String(userId).padStart(6, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function ensureTechnician(model, staff, userId, status) {
  const profiles = await model.technicianProfilesForUser(userId);

  if (profiles.length > 1) {
    fail(
      "Duplicate technician profiles need review before changing this account.",
      409,
    );
  }

  if (profiles.length) {
    return profiles[0];
  }

  const result = await model.addTechnician({
    userId,
    code: technicianCode(userId),
    status,
  });

  await model.audit(staff.id, "CREATE", "technicians", result.insertId);

  return {
    id: result.insertId,
    status,
  };
}

export async function createStaff(model, staff, data) {
  const email = data.email.toLowerCase();

  if ((await model.getStaffByEmail(email))[0]) {
    fail("This email is already in use.", 409);
  }

  const hash = await bcrypt.hash(data.password, 12);

  const created = (
    await model.createStaff(
      {
        ...data,
        email,
      },
      hash,
    )
  ).insertId;

  // Automatically create the linked technician profile.
  // Both records are committed by workspaceService.
  if (data.role === "TECHNICIAN") {
    await ensureTechnician(model, staff, created, "ACTIVE");
  }

  return created;
}

export async function updateStaff(model, staff, id, data, connection) {
  const account = (await model.staffForUpdate(id))[0];

  if (!account) {
    fail("Staff account not found.", 404);
  }

  if (account.role === "OWNER") {
    fail("Owner accounts cannot be changed here.", 403);
  }

  if (Number(staff.id) === Number(id) && data.status !== "ACTIVE") {
    fail("You cannot disable your own account.", 409);
  }

  const wasActive =
    account.role === "TECHNICIAN" && account.status === "ACTIVE";

  const willBeActive = data.role === "TECHNICIAN" && data.status === "ACTIVE";

  const profiles = await model.technicianProfilesForUser(id);

  if (profiles.length > 1) {
    fail(
      "Duplicate technician profiles need review before changing this account.",
      409,
    );
  }

  // Do not remove access while unfinished jobs
  // are still assigned to this technician.
  if (
    profiles.length &&
    !willBeActive &&
    (account.role !== data.role || account.status !== data.status)
  ) {
    const activeJobs =
      await staffAccountDeletionModel(connection).activeTechnicianWork(id);

    if (activeJobs > 0) {
      fail(
        `Reassign or finish ${activeJobs} active technician job(s) before changing this account.`,
        409,
      );
    }
  }

  // Archived profiles must be restored explicitly.
  if (
    willBeActive &&
    profiles.length &&
    (await archiveModel(connection).isArchived("technicians", profiles[0].id))
  ) {
    fail(
      "Restore this technician profile from Archive before activating the account.",
      409,
    );
  }

  const result = await model.changeStaff(id, data.role, data.status);

  if (result.affectedRows === 1) {
    if (data.role === "TECHNICIAN") {
      const profile =
        profiles[0] ||
        (await ensureTechnician(
          model,
          staff,
          id,
          willBeActive ? "ACTIVE" : "INACTIVE",
        ));

      const nextStatus = !willBeActive
        ? "INACTIVE"
        : !wasActive
          ? "ACTIVE"
          : profile.status;

      if (profile.status !== nextStatus) {
        await model.updateTechnician(profile.id, nextStatus);

        await model.audit(staff.id, "UPDATE", "technicians", profile.id);
      }
    } else if (profiles.length && profiles[0].status !== "INACTIVE") {
      // Preserve historical technician records
      // when a staff member changes roles.
      await model.updateTechnician(profiles[0].id, "INACTIVE");

      await model.audit(staff.id, "UPDATE", "technicians", profiles[0].id);
    }

    // Preserve existing staff session revocation.
    await model.revokeAllForStaff(id);
  }

  return {
    result,
    converted: null,
  };
}
