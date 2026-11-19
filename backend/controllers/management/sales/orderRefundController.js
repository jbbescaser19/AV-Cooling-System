import { confirmOrderCashRefund } from "../../../services/management/sales/orderRefundService.js";
import { handle } from "./salesControllerHelpers.js";

export const confirmOrderCashRefundController = handle((req) =>
  confirmOrderCashRefund(req.staff, req.params.paymentId, req.body),
);
