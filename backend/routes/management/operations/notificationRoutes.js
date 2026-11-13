import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import {
  notificationControllers,
  notificationOverviewController,
  markAllStaffNotificationsController,
  deleteStaffNotificationController,
  clearStaffNotificationsController,
} from "../../../controllers/management/operations/notificationController.js";

// Mounted under /api/management/workspace/notifications.
// The parent router already requires an authenticated staff session.
const router = Router();

router.get("/overview", notificationOverviewController);
router.get("/", notificationControllers.list);

// Specific routes must precede /:id.
router.patch(
  "/read-all",
  requireCustomerWriteOrigin,
  markAllStaffNotificationsController,
);
router.delete(
  "/clear",
  requireCustomerWriteOrigin,
  clearStaffNotificationsController,
);
router.patch(
  "/:id",
  requireCustomerWriteOrigin,
  notificationControllers.update,
);
router.delete(
  "/:id",
  requireCustomerWriteOrigin,
  deleteStaffNotificationController,
);

export default router;
