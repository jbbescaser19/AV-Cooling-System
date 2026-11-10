import { fail } from "../workspaceHelpers.js";
export async function createProducts(model, staff, data) {
  let created;
  if (data.promoPrice != null && data.promoPrice >= data.srp) {
    fail("Promo price must be below SRP.");
  }
  const product = await model.createProduct(data);
  const variant = await model.createVariant(product.insertId, data);
  await model.ensureInventory(variant.insertId);
  created = product.insertId;
  return created;
}
export async function updateProducts(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.updateProduct(id, data);
  return { result, converted };
}
