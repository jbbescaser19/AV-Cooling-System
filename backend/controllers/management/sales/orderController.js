import {
  getSalesOrders,
  getSalesOrderDetails,
} from "../../../services/management/sales/orderService.js";
import { handle } from "./salesControllerHelpers.js";
export const listSalesOrdersController = handle((req) =>
  getSalesOrders(req.staff, req.query),
);
export const salesOrderDetailController = handle((req) =>
  getSalesOrderDetails(req.staff, req.params.id),
);
