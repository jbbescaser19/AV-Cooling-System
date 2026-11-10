import { Router } from "express";
import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import {
  listManagementServices,
  changeManagementService,
} from "../../../controllers/management/services/serviceEventController.js";
const router = Router();
router.get(
  "/services",
  requireStaffRole("OWNER", "MANAGER"),
  listManagementServices,
);
router.post(
  "/services/:requestId/events",
  requireCustomerWriteOrigin,
  changeManagementService,
);
export default router;
