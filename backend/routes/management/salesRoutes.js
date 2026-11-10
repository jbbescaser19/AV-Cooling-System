import { Router } from "express";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  posCatalogController,
  createPosSaleController,
} from "../../controllers/management/sales/posController.js";
import {
  walkInServicesController,
  bookWalkInServiceController,
} from "../../controllers/management/sales/walkInServiceController.js";
import {
  listSalesOrdersController,
  salesOrderDetailController,
} from "../../controllers/management/sales/orderController.js";
import {
  listSalesPaymentsController,
  confirmCashController,
} from "../../controllers/management/sales/paymentController.js";

const router = Router();

router.use(
  requireStaffAuth,
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
);

router.get("/catalog", posCatalogController);
router.get("/walk-in-services", walkInServicesController);
router.post(
  "/walk-in-services",
  requireCustomerWriteOrigin,
  bookWalkInServiceController,
);

router.post("/pos", requireCustomerWriteOrigin, createPosSaleController);

router.get("/orders", listSalesOrdersController);

router.get("/orders/:id", salesOrderDetailController);

router.get("/payments", listSalesPaymentsController);

router.post(
  "/payments/:paymentId/confirm-cash",
  requireCustomerWriteOrigin,
  confirmCashController,
);

export default router;
