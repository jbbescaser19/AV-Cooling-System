import { Router } from "express";

import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";

import {
  getOrderPricing,
  updateOrderPricing,
  getServicePricing,
  updateServicePricing,
} from "../../../controllers/management/pricing/priceAdjustmentController.js";

const router = Router();

const managers = requireStaffRole("OWNER", "MANAGER");

router.get("/orders/:id/price-adjustment", managers, getOrderPricing);

router.patch(
  "/orders/:id/price-adjustment",
  managers,
  requireCustomerWriteOrigin,
  updateOrderPricing,
);

router.get("/services/:id/price-adjustment", managers, getServicePricing);

router.patch(
  "/services/:id/price-adjustment",
  managers,
  requireCustomerWriteOrigin,
  updateServicePricing,
);

export default router;
