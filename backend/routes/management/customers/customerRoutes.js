import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";
import { customerControllers } from "../../../controllers/management/customers/customerController.js";
import {
  previewCustomerDeletionController,
  deleteCustomerAccountController,
} from "../../../controllers/management/customers/customerDeletionController.js";

const router = Router();
router.get("/", customerControllers.list);
router.get(
  "/:id/deletion-preview",
  requireStaffRole("OWNER"),
  previewCustomerDeletionController,
);
router.patch("/:id", requireCustomerWriteOrigin, customerControllers.update);
router.delete(
  "/:id",
  requireStaffRole("OWNER"),
  requireCustomerWriteOrigin,
  deleteCustomerAccountController,
);
export default router;
