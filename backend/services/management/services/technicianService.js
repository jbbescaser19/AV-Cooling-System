import { fail } from "../workspaceHelpers.js";
export async function createTechnicians(model, staff, data) {
  let created;
  const user = (await model.userForTechnician(data.userId))[0];
  if (!user) {
    fail("Choose an active staff account with the TECHNICIAN role.", 409);
  }
  created = (await model.addTechnician(data)).insertId;
  return created;
}
export async function updateTechnicians(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.updateTechnician(id, data.status);
  return { result, converted };
}
