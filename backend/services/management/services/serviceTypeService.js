export async function createServiceTypes(model, staff, data) {
  let created;
  created = (await model.createServiceType(data)).insertId;
  return created;
}
export async function updateServiceTypes(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.updateServiceType(id, data);
  return { result, converted };
}
