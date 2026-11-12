import { Router } from "express";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  posCatalogController,
  posCustomersController,
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
  confirmManualTransferController,
  confirmServiceCashController,
  confirmServiceTransferController,
} from "../../controllers/management/sales/paymentController.js";

import { completedInstallationsController } from "../../controllers/management/services/installationHistoryController.js";
const router = Router();

router.use(
  requireStaffAuth,
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
);

router.get("/catalog", posCatalogController);
router.get("/pos-customers", posCustomersController);
router.get("/walk-in-services", walkInServicesController);
router.post(
  "/walk-in-services",
  requireCustomerWriteOrigin,
  bookWalkInServiceController,
);

router.post("/pos", requireCustomerWriteOrigin, createPosSaleController);

// Cashier access ends after POS product sales and walk-in service intake.
// Orders, payments, job history and manual confirmations are management-only.
router.use(requireStaffRole("OWNER", "MANAGER"));

router.get("/completed-installations", completedInstallationsController);
router.get("/orders", listSalesOrdersController);

router.get("/orders/:id", salesOrderDetailController);

router.get("/payments", listSalesPaymentsController);
router.post(
  "/service-payments/:paymentId/confirm-cash",
  requireCustomerWriteOrigin,
  confirmServiceCashController,
);
router.post(
  "/service-payments/:paymentId/confirm-transfer",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  confirmServiceTransferController,
);

router.post(
  "/payments/:paymentId/confirm-transfer",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  confirmManualTransferController,
);
router.post(
  "/payments/:paymentId/confirm-cash",
  requireCustomerWriteOrigin,
  confirmCashController,
);

export default router;
