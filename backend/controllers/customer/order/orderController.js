import {
  placeCustomerOrder,
  listCustomerOrders,
  getCustomerOrder,
  editCustomerOrder,
  cancelCustomerOrder,
} from "../../../services/customer/order/orderService.js";

function handleError(res, error) {
  const status =
    Number(error.status) >= 400 && Number(error.status) < 500
      ? Number(error.status)
      : 500;

  if (status === 500) {
    console.error("Order API failed:", error);
  }

  return res.status(status).json({
    success: false,
    message: status === 500 ? "Unable to process the order." : error.message,
  });
}

export async function placeOrderController(req, res) {
  try {
    const order = await placeCustomerOrder(req.auth.userId, req.body);

    return res
      .status(order.replayed ? 200 : 201)
      .json({ success: true, order });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listOrdersController(req, res) {
  try {
    return res.json({
      success: true,
      orders: await listCustomerOrders(req.auth.userId),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getOrderController(req, res) {
  try {
    return res.json({
      success: true,
      order: await getCustomerOrder(req.auth.userId, req.params.orderNumber),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function editOrderController(req, res) {
  try {
    const order = await editCustomerOrder(
      req.auth.userId,
      req.params.orderNumber,
      req.body,
    );

    return res.json({
      success: true,
      message: "Order details updated.",
      order,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function cancelOrderController(req, res) {
  try {
    const order = await cancelCustomerOrder(
      req.auth.userId,
      req.params.orderNumber,
      req.body,
    );

    return res.json({
      success: true,
      message: "Order cancelled.",
      order,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
