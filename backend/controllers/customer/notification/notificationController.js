import {
  listCustomerNotifications,
  getCustomerUnreadCount,
  markCustomerNotificationRead,
  markAllCustomerNotificationsRead,
  deleteCustomerNotification,
  deleteAllCustomerNotifications,
  getCustomerEventHistory,
} from "../../../services/customer/notification/notificationService.js";
function handle(fn) {
  return async (req, res) => {
    try {
      return res.json({ success: true, ...(await fn(req)) });
    } catch (error) {
      const status =
        Number(error.status) >= 400 && Number(error.status) < 500
          ? Number(error.status)
          : 500;
      if (status === 500) console.error("Customer notification:", error);
      return res
        .status(status)
        .json({
          success: false,
          message:
            status === 500 ? "Notifications unavailable." : error.message,
        });
    }
  };
}
export const listNotificationsController = handle((req) =>
  listCustomerNotifications(req.auth.userId, {
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: req.query.unread === "true",
  }),
);
export const unreadCountController = handle((req) =>
  getCustomerUnreadCount(req.auth.userId),
);
export const markNotificationReadController = handle((req) =>
  markCustomerNotificationRead(req.auth.userId, req.params.notificationId),
);
export const markAllNotificationsReadController = handle((req) =>
  markAllCustomerNotificationsRead(req.auth.userId),
);
export const deleteNotificationController = handle((req) =>
  deleteCustomerNotification(req.auth.userId, req.params.notificationId),
);
export const clearNotificationsController = handle((req) =>
  deleteAllCustomerNotifications(req.auth.userId),
);
export const customerEventHistoryController = handle((req) =>
  getCustomerEventHistory(req.auth.userId, req.params.kind, req.params.ref),
);
