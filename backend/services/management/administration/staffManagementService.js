import { fail } from "../workspaceHelpers.js";
import bcrypt from "bcrypt";
export async function createStaff(model, staff, data) {
  let created;
  if ((await model.getStaffByEmail(data.email.toLowerCase()))[0]) {
    fail("This email is already in use.", 409);
  }
  const hash = await bcrypt.hash(data.password, 12);
  created = (
    await model.createStaff({ ...data, email: data.email.toLowerCase() }, hash)
  ).insertId;
  return created;
}
export async function updateStaff(model, staff, id, data) {
  let result;
  let converted = null;
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
  result = await model.changeStaff(id, data.role, data.status);
  if (result.affectedRows === 1) {
    // Revocation is committed with the staff change by workspaceService.
    await model.revokeAllForStaff(id);
  }
  return { result, converted };
}
