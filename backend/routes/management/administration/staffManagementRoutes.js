import { Router } from "express";
import {
  requireStaffRecentAuth,
  requireStaffRole,
} from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { staffManagementControllers } from "../../../controllers/management/administration/staffManagementController.js";
import {
  previewStaffDeletionController,
  deleteStaffAccountController,
} from "../../../controllers/management/administration/staffAccountDeletionController.js";
const router = Router();
router.get("/", staffManagementControllers.list);
router.get(
  "/:id/deletion-preview",
  requireStaffRole("OWNER"),
  previewStaffDeletionController,
);
router.post(
  "/",
  requireCustomerWriteOrigin,
  requireStaffRecentAuth,
  staffManagementControllers.create,
);
router.patch(
  "/:id",
  requireCustomerWriteOrigin,
  requireStaffRecentAuth,
  staffManagementControllers.update,
);
router.delete(
  "/:id",
  requireStaffRole("OWNER"),
  requireCustomerWriteOrigin,
  deleteStaffAccountController,
);
export default router;
