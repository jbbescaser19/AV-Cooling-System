import { Router } from "express";
import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { updateTechnicianOrderProgress } from "../../../controllers/management/services/technicianOrderProgressController.js";

const router = Router();
router.patch(
  "/:orderId",
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
  requireCustomerWriteOrigin,
  updateTechnicianOrderProgress,
);
export default router;
