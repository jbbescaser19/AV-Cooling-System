import { fail } from "../workspaceHelpers.js";
export async function updateCustomers(model, staff, id, data) {
  let result;
  let converted = null;
  const item = (await model.customerForUpdate(id))[0];
  if (!item) {
    fail("Customer not found.", 404);
  }
  await model.setCustomerStatus(id, item.userId, data.status);
  result = { affectedRows: 1 };
  return { result, converted };
}
