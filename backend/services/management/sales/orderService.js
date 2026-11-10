import connectDB from "../../../utils/dbConn.js";
import { orderModel } from "../../../models/management/sales/orderModel.js";
import { fail, validStaff } from "./salesHelpers.js";
export async function getSalesOrders(staff) {
  validStaff(staff);
  return { orders: await orderModel(connectDB).orders() };
}
export async function getSalesOrderDetails(staff, rawId) {
  validStaff(staff);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) fail("Invalid order ID.");
  const model = orderModel(connectDB);
  const order = await model.orderDetails(id);
  if (!order) fail("Order not found.", 404);
  return { order: { ...order, items: await model.orderItems(id) } };
}
