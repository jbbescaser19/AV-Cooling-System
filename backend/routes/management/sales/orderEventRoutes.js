import { Router } from "express";

import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";

import {
  listManagementOrders,
  changeManagementOrder,
} from "../../../controllers/management/sales/orderEventController.js";

const router = Router();

router.get(
  "/orders",
  requireStaffRole("OWNER", "MANAGER"),
  listManagementOrders,
);

router.post(
  "/orders/:orderNumber/events",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  changeManagementOrder,
);

export default router;
