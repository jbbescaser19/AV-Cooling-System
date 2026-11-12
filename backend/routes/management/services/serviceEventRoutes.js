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
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
  listManagementServices,
);

router.get(
  "/services/:requestId/activity",
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"),
  listServiceActivityController,
);

router.get(
  "/services/:requestId/payment",
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
  getManagementServicePayment,
);

router.post(
  "/services/:requestId/events",
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),

  requireCustomerWriteOrigin,

  (req, res, next) => {
    if (
      req.staff?.role === "SALES_CASHIER" &&
      Array.isArray(req.body?.technicianIds) &&
      req.body.technicianIds.length > 0
    ) {
      return res.status(403).json({
        success: false,
        message: "Only an Owner or Manager can assign technicians.",
      });
    }

    return next();
  },

  changeManagementService,
);

export default router;
