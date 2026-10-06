const POS_ORDERS_KEY = "av_pos_orders";
const NOTIFICATIONS_KEY = "av_management_notifications";

export function getPosOrders() {
  try {
    return JSON.parse(localStorage.getItem(POS_ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePosOrder(order) {
  const orders = getPosOrders();
  const next = [order, ...orders];
  localStorage.setItem(POS_ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("av-management-updated"));
  return order;
}

export function getStoredNotifications(fallback = []) {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function saveNotifications(items) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("av-management-updated"));
}

export function addManagementNotification(notification, fallback = []) {
  const list = getStoredNotifications(fallback);
  const next = [notification, ...list];
  saveNotifications(next);
  return next;
}

export function createPosOrderId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `POS-${date}-${time}`;
}
