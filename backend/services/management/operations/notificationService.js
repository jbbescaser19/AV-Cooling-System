import connectDB from "../../../utils/dbConn.js";
import { notificationModel } from "../../../models/management/operations/notificationModel.js";
import { fail } from "../workspaceHelpers.js";

const notificationRoles = ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"];

function assertStaff(staff) {
  if (
    !Number.isSafeInteger(Number(staff?.id)) ||
    !notificationRoles.includes(staff?.role)
  ) {
    fail("A valid staff account is required.", 403);
  }
  return Number(staff.id);
}

function notificationId(rawId) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid notification ID.", 400);
  }
  return id;
}

export async function getStaffNotificationOverview(staff) {
  const staffId = assertStaff(staff);
  const model = notificationModel(connectDB);
  const canViewStock = ["OWNER", "MANAGER"].includes(staff.role);
  const [items, unreadCount, lowStockCount, lowStockItems] = await Promise.all([
    model.listRecentNotifications(staffId),
    model.unreadNotificationCount(staffId),
    canViewStock ? model.lowStockCount() : Promise.resolve(0),
    canViewStock ? model.listLowStock(6) : Promise.resolve([]),
  ]);
  return { items, unreadCount, lowStockCount, lowStockItems };
}

export async function markAllStaffNotificationsRead(staff) {
  const result = await notificationModel(connectDB).markAllOwnNotificationsRead(
    assertStaff(staff),
  );
  return {
    count: result.affectedRows,
    message: "Notifications marked as read.",
  };
}

export async function deleteStaffNotification(staff, rawId) {
  const result = await notificationModel(connectDB).deleteOwnNotification(
    notificationId(rawId),
    assertStaff(staff),
  );
  if (!result.affectedRows) fail("Notification not found.", 404);
  return { message: "Notification deleted." };
}

export async function clearStaffNotifications(staff) {
  const result = await notificationModel(connectDB).clearOwnNotifications(
    assertStaff(staff),
  );
  return {
    count: result.affectedRows,
    message: "Your saved notifications have been cleared.",
  };
}

/** Retained for the existing Workspace PATCH /notifications/:id handler. */
export async function updateNotifications(model, staff, id, data) {
  const result = await model.markOwnNotification(
    id,
    assertStaff(staff),
    data.isRead,
  );
  if (!result.affectedRows) fail("Notification not found.", 404);
  return { result, converted: null };
}
