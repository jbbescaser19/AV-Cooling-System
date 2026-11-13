import { Router } from "express";
import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import { customerCheckoutController } from "../../controllers/payments/paymongoController.js";

const router = Router();

router.post(
  "/checkout",
  requireCustomerAuth,
  requireCustomerWriteOrigin,
  customerCheckoutController,
);

export default router;
