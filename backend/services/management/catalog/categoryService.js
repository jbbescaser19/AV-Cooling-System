export async function createCategories(model, staff, data) {
  let created;
  created = (await model.createCategory(data)).insertId;
  return created;
}
export async function updateCategories(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.updateCategory(id, data);
  return { result, converted };
}
