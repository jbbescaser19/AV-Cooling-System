import { Router } from "express";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import orderRoutes from "./sales/orderEventRoutes.js";
import serviceRoutes from "./services/serviceEventRoutes.js";
import priceAdjustmentRoutes from "./pricing/priceAdjustmentRoutes.js";
import sourceTeamRoutes from "./services/sourceTeamRoutes.js";

const router = Router();

router.use(
  requireStaffAuth,
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
);

router.use(orderRoutes);
router.use(serviceRoutes);
router.use(priceAdjustmentRoutes);
router.use("/field-work", sourceTeamRoutes);

export default router;
