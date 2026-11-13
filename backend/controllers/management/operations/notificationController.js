import { createModuleControllers } from "../workspaceController.js";
import {
  getStaffNotificationOverview,
  markAllStaffNotificationsRead,
  deleteStaffNotification,
  clearStaffNotifications,
} from "../../../services/management/operations/notificationService.js";

export const notificationControllers = createModuleControllers("notifications");

function endpoint(action) {
  return async (req, res) => {
    try {
      const data = await action(req);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      const status = Number(error.status);
      const safeStatus = status >= 400 && status < 500 ? status : 500;
      if (safeStatus === 500) {
        console.error("Management notifications:", error);
      }
      return res.status(safeStatus).json({
        success: false,
        message:
          safeStatus === 500
            ? "Unable to update notifications."
            : error.message,
      });
    }
  };
}

export const notificationOverviewController = endpoint((req) =>
  getStaffNotificationOverview(req.staff),
);
export const markAllStaffNotificationsController = endpoint((req) =>
  markAllStaffNotificationsRead(req.staff),
);
export const deleteStaffNotificationController = endpoint((req) =>
  deleteStaffNotification(req.staff, req.params.id),
);
export const clearStaffNotificationsController = endpoint((req) =>
  clearStaffNotifications(req.staff),
);
