import { fail } from "../workspaceHelpers.js";

// Compatibility path for technician accounts
// created before automatic profile linking.
export async function createTechnicians(model, staff, data) {
  const user = (await model.userForTechnician(data.userId))[0];

  if (!user) {
    fail("Choose an active staff account with the TECHNICIAN role.", 409);
  }

  const existing = await model.technicianProfilesForUser(data.userId);

  if (existing.length) {
    fail("This staff account already has a technician profile.", 409);
  }

  return (await model.addTechnician(data)).insertId;
}

export async function updateTechnicians(model, staff, id, data) {
  const account = (await model.technicianAccountForUpdate(id))[0];

  if (!account) {
    fail("Technician profile not found.", 404);
  }

  if (
    data.status !== "INACTIVE" &&
    (account.accountType !== "STAFF" ||
      account.role !== "TECHNICIAN" ||
      account.accountStatus !== "ACTIVE" ||
      account.deletedAt)
  ) {
    fail("Activate the linked Technician staff account first.", 409);
  }

  const result = await model.updateTechnician(id, data.status);

  return {
    result,
    converted: null,
  };
}
