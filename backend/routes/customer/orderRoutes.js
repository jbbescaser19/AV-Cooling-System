import { Router } from "express";
import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  placeOrderController,
  listOrdersController,
  getOrderController,
  editOrderController,
  cancelOrderController,
  paymentOptionsController,
  reportManualTransferController,
} from "../../controllers/customer/order/orderController.js";

const router = Router();

router.use(requireCustomerAuth);

router.get("/", listOrdersController);
router.get("/payment-options", paymentOptionsController);
router.post(
  "/:orderNumber/report-transfer",
  requireCustomerWriteOrigin,
  reportManualTransferController,
);
router.get("/:orderNumber", getOrderController);

router.post("/", requireCustomerWriteOrigin, placeOrderController);

router.patch("/:orderNumber", requireCustomerWriteOrigin, editOrderController);

router.post(
  "/:orderNumber/cancel",
  requireCustomerWriteOrigin,
  cancelOrderController,
  paymentOptionsController,
  reportManualTransferController,
);

export default router;
