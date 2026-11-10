import { fail } from "../workspaceHelpers.js";
export async function updateVariants(model, staff, id, data) {
  let result;
  let converted = null;
  if (data.promoPrice != null && data.promoPrice >= data.srp) {
    fail("Promo must be lower than SRP.");
  }
  result = await model.updateVariant(id, data);
  return { result, converted };
}
