import { Router } from "express";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import {
  getManagementDashboardController,
  getDashboardFinancialsController,
} from "../../controllers/management/dashboardController.js";

const router = Router();

router.use(requireStaffAuth);

router.get(
  "/financials",
  requireStaffRole("OWNER", "MANAGER"),
  getDashboardFinancialsController,
);

router.get(
  "/",
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
  getManagementDashboardController,
);

export default router;
