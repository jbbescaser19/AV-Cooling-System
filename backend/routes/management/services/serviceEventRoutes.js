import { Router } from "express";

import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";

import {
  listManagementServices,
  changeManagementService,
  listServiceActivityController,
  getManagementServicePayment,
} from "../../../controllers/management/services/serviceEventController.js";

const router = Router();

router.get(
  "/services",
  requireStaffRole("OWNER", "MANAGER"),
  listManagementServices,
);

router.get(
  "/services/:requestId/activity",
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
  listServiceActivityController,
);

router.get(
  "/services/:requestId/payment",
  requireStaffRole("OWNER", "MANAGER"),
  getManagementServicePayment,
);

router.post(
  "/services/:requestId/events",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  changeManagementService,
);

export default router;
