import { Router } from "express";
import { requireStaffRecentAuth } from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { staffManagementControllers } from "../../../controllers/management/administration/staffManagementController.js";
const router = Router();
router.get("/", staffManagementControllers.list);
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
export default router;
