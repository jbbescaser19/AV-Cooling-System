import connectDB from "../../../utils/dbConn.js";
import { notificationModel } from "../../../models/customer/notification/notificationModel.js";
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
const id = (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) fail("Invalid identifier.");
  return n;
};
export async function createCustomerNotification(
  db,
  userId,
  type,
  title,
  message,
  path = null,
) {
  const model = notificationModel(db);
  if (!(await model.activeCustomer(id(userId))))
    fail("Active customer not found.", 404);
  return model.create(id(userId), type, title, message, path);
}
export async function listCustomerNotifications(userId, opts = {}) {
  const uid = id(userId),
    model = notificationModel(connectDB);
  if (!(await model.activeCustomer(uid)))
    fail("Active customer required.", 403);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 30));
  const page = Math.min(1000, Math.max(1, Number(opts.page) || 1));
  return {
    notifications: await model.list(
      uid,
      opts.unreadOnly === true,
      limit,
      (page - 1) * limit,
    ),
    page,
  };
}
export async function getCustomerUnreadCount(userId) {
  return {
    unreadCount: await notificationModel(connectDB).unreadCount(id(userId)),
  };
}
export async function markCustomerNotificationRead(userId, rawId) {
  const uid = id(userId),
    notificationId = id(rawId),
    model = notificationModel(connectDB);
  if (!(await model.owns(uid, notificationId)))
    fail("Notification not found.", 404);
  await model.markRead(uid, notificationId);
  return { message: "Marked as read." };
}
export async function markAllCustomerNotificationsRead(userId) {
  const count = await notificationModel(connectDB).markAllRead(id(userId));
  return { updated: count };
}
export async function deleteCustomerNotification(userId, rawId) {
  const count = await notificationModel(connectDB).deleteOne(
    id(userId),
    id(rawId),
  );
  if (!count) fail("Notification not found.", 404);
  return { message: "Notification deleted." };
}
export async function deleteAllCustomerNotifications(userId) {
  const count = await notificationModel(connectDB).deleteAll(id(userId));
  return { deleted: count };
}
export async function getCustomerEventHistory(userId, kind, ref) {
  const uid = id(userId),
    model = notificationModel(connectDB),
    type = String(kind).toUpperCase();
  if (type !== "ORDER" && type !== "SERVICE") fail("Invalid activity type.");
  const recordId =
    type === "ORDER"
      ? await model.findOwnedOrderId(uid, ref)
      : await model.findOwnedServiceId(uid, id(ref));
  if (!recordId) fail("Record not found.", 404);
  return { events: await model.findActivity(type, recordId) };
}
