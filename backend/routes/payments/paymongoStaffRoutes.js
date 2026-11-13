import { Router } from "express";
import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import { staffCheckoutController } from "../../controllers/payments/paymongoController.js";

const router = Router();
router.post(
  "/checkout",
  requireStaffAuth,
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
  requireCustomerWriteOrigin,
  staffCheckoutController,
);
export default router;
