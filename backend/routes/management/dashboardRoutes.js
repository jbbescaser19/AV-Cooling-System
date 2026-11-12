import { Router } from "express";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import { getManagementDashboardController } from "../../controllers/management/dashboardController.js";

const router = Router();

router.use(requireStaffAuth);

router.get(
  "/",
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
  getManagementDashboardController,
);

export default router;
