import connectDB from "../../../utils/dbConn.js";

import { orderModel } from "../../../models/management/sales/orderModel.js";

import { orderPaymentDetailsModel } from "../../../models/management/sales/orderPaymentDetailsModel.js";

import { fail, validStaff } from "./salesHelpers.js";

import { validateOrderListQuery } from "../../../validators/management/sales/orderListValidator.js";

export async function getSalesOrders(staff, rawQuery = {}) {
  validStaff(staff);

  const filters = validateOrderListQuery(rawQuery);

  const result = await orderModel(connectDB).orders(filters);

  return {
    orders: result.rows,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

export async function getSalesOrderDetails(staff, rawId) {
  validStaff(staff);

  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid order ID.");
  }

  const model = orderModel(connectDB);

  const order = await model.orderDetails(id);

  if (!order) {
    fail("Order not found.", 404);
  }

  const [items, payment] = await Promise.all([
    model.orderItems(id),
    orderPaymentDetailsModel(connectDB).forOrder(id),
  ]);

  return {
    order: {
      ...order,
      items,
      payment,
    },
  };
}
