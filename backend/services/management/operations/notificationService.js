export async function updateNotifications(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.markOwnNotification(id, staff.id, data.isRead);
  return { result, converted };
}
