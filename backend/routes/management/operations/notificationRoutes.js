import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { notificationControllers } from "../../../controllers/management/operations/notificationController.js";
const router = Router();
router.get("/", notificationControllers.list);
router.patch(
  "/:id",
  requireCustomerWriteOrigin,
  notificationControllers.update,
);
export default router;
