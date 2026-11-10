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
