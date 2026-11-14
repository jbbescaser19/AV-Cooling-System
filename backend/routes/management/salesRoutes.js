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
  confirmServiceCashController,
} from "../../controllers/management/sales/paymentController.js";

import { confirmServiceCashRefundController } from "../../controllers/management/sales/serviceRefundController.js";

import { completedInstallationsController } from "../../controllers/management/services/installationHistoryController.js";

const router = Router();

router.use(
  requireStaffAuth,
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
);

// POS features available to Owner, Manager, and Cashier.
router.get("/catalog", posCatalogController);

router.get("/pos-customers", posCustomersController);

router.post("/pos", requireCustomerWriteOrigin, createPosSaleController);

// Cashiers can CREATE walk-in service bookings through POS.
// They cannot manage or approve existing service requests.
router.get("/walk-in-services", walkInServicesController);

router.post(
  "/walk-in-services",
  requireCustomerWriteOrigin,
  bookWalkInServiceController,
);

// Everything below requires Owner or Manager.
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
  "/service-payments/:paymentId/confirm-refund",
  requireCustomerWriteOrigin,
  confirmServiceCashRefundController,
);

router.post(
  "/payments/:paymentId/confirm-cash",
  requireCustomerWriteOrigin,
  confirmCashController,
);

export default router;
