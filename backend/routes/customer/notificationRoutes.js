import { Router } from "express";
import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import {
  listNotificationsController,
  unreadCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
  clearNotificationsController,
  customerEventHistoryController,
} from "../../controllers/customer/notification/notificationController.js";
const router = Router();
router.use(requireCustomerAuth);
router.get("/", listNotificationsController);
router.get("/unread-count", unreadCountController);
router.get("/activity/:kind/:ref", customerEventHistoryController);
router.patch(
  "/read-all",
  requireCustomerWriteOrigin,
  markAllNotificationsReadController,
);
router.patch(
  "/:notificationId/read",
  requireCustomerWriteOrigin,
  markNotificationReadController,
);
router.delete(
  "/clear-all",
  requireCustomerWriteOrigin,
  clearNotificationsController,
);
router.delete(
  "/:notificationId",
  requireCustomerWriteOrigin,
  deleteNotificationController,
);
export default router;
