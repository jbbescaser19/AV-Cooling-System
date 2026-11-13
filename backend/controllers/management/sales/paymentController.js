import { confirmServicePayment } from "../../../services/management/sales/servicePaymentService.js";
import {
  getSalesPayments,
  confirmCollectedCash,
} from "../../../services/management/sales/paymentService.js";
import { handle } from "./salesControllerHelpers.js";

export const listSalesPaymentsController = handle((req) =>
  getSalesPayments(req.staff),
);

export const confirmCashController = handle((req) =>
  confirmCollectedCash(req.staff, req.params.paymentId, req.body),
);

export const confirmServiceCashController = handle((req) =>
  confirmServicePayment(req.staff, req.params.paymentId, "cash", req.body),
);
