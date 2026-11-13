import { getDeliveryFee } from "../../shared/deliveryPricingService.js";
import { paymongoConfigured } from "../../payments/paymongoService.js";
import connectDB from "../../../utils/dbConn.js";
import { createCustomerNotification } from "../notification/notificationService.js";
import {
  reserveAppointment,
  releaseAppointment,
} from "../../scheduling/bookingScheduleService.js";
import { orderModel } from "../../../models/customer/order/orderModel.js";
import {
  reserveForOrder,
  releaseOrderReservation,
} from "./stockReservationService.js";
import { workspaceModel } from "../../../models/management/workspaceModel.js";
import { validateCheckout } from "../../../validators/customer/order/orderValidator.js";
import {
  validateOrderEdit,
  validateOrderCancellation,
} from "../../../validators/customer/order/orderChangeValidator.js";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function moneyCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999) {
    fail("Product price is unavailable. Please contact the store.", 409);
  }
  return Math.round(amount * 100);
}

function checkedItem(row, quantity) {
  if (
    !row ||
    row.productStatus !== "ACTIVE" ||
    row.variantStatus !== "ACTIVE"
  ) {
    fail("A selected product is no longer available. Review your cart.", 409);
  }
  const promo = Number(row.promoPrice);
  const srp = Number(row.srp);
  const unitCents = moneyCents(promo > 0 && promo < srp ? promo : srp);
  if (unitCents === 0) fail("A selected product has no valid price.", 409);
  return {
    variantId: Number(row.variantId),
    productName: row.productName,
    modelName: row.modelName,
    quantity,
    unitPrice: (unitCents / 100).toFixed(2),
    lineTotal: ((unitCents * quantity) / 100).toFixed(2),
    cents: unitCents * quantity,
  };
}

async function loadOrders(model, customerId, orderNumber = null) {
  const orders = await model.orders(customerId, orderNumber);
  const ids = orders.map((item) => item.orderId);
  const [rows, events] = await Promise.all([
    model.itemsForOrders(ids),
    model.historyForOrders(ids),
  ]);
  const history = new Map();
  for (const event of events) {
    if (!history.has(event.orderId)) history.set(event.orderId, []);
    history.get(event.orderId).push(event);
  }
  const lines = new Map();
  for (const line of rows) {
    if (!lines.has(line.orderId)) lines.set(line.orderId, []);
    lines.get(line.orderId).push(line);
  }
  return orders.map((order) => ({
    ...order,
    items: lines.get(order.orderId) || [],
    history: history.get(order.orderId) || [],
    canManage:
      order.channel === "ONLINE" &&
      order.status === "PENDING" &&
      order.paymentStatus === "PENDING" &&
      order.recordedPaymentStatus === "PENDING" &&
      order.paymentCode === "CASH" &&
      !Boolean(order.hasWorkOrder) &&
      !Boolean(order.hasBlockingPayment),
  }));
}

export async function placeCustomerOrder(userId, rawInput) {
  const input = validateCheckout(rawInput);
  const orderNumber = `AV-${input.requestId.replaceAll("-", "").toUpperCase()}`;
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const model = orderModel(db);
    // Same customer-row lock as the cart service: serialize cart edits/checkout.
    const customer = await model.customer(userId, true);
    if (!customer) fail("Active customer account required.", 403);
    const existing = await model.existingByNumber(orderNumber);
    if (existing) {
      if (Number(existing.customerId) !== Number(customer.customerId)) {
        fail("Checkout reference already used. Start a new checkout.", 409);
      }
      const [replayed] = await loadOrders(
        model,
        customer.customerId,
        orderNumber,
      );
      await db.commit();
      return { ...replayed, replayed: true };
    }

    if (input.paymentCode !== "CASH" && !paymongoConfigured()) {
      fail(
        "Secure PayMongo Checkout is not available yet. Please choose Cash.",
        503,
      );
    }
    const methodId = await model.paymentMethod(input.paymentCode);
    if (!methodId)
      fail(
        "This payment method is currently unavailable. Choose another method.",
        409,
      );

    let cartId = null;
    const lines = [];
    if (input.source === "CART") {
      cartId = await model.activeCart(customer.customerId);
      if (!cartId) fail("Your cart is empty. Review your selection.", 409);
      for (const item of input.items) {
        const row = await model.cartLine(cartId, item.variantId);
        if (!row || Number(row.quantity) !== item.quantity) {
          fail(
            "Your selected cart changed. Return to the cart and review it.",
            409,
          );
        }
        lines.push(checkedItem(row, item.quantity));
      }
    } else {
      const horsepower = Number(input.hp.slice(0, -2));
      const row = await model.directVariant(input.productId, horsepower);
      lines.push(checkedItem(row, input.quantity));
    }

    const subtotalCents = lines.reduce((sum, item) => sum + item.cents, 0);
    // Never trust the browser's delivery price. Validate the selected area
    // against the customer's complete city/province address on the server.
    const deliveryFeeCents = Math.round(
      getDeliveryFee(input.deliveryArea, input.deliveryAddress) * 100,
    );
    const totalCents = subtotalCents + deliveryFeeCents;
    if (
      !Number.isSafeInteger(totalCents) ||
      totalCents <= 0 ||
      totalCents > 999999999999
    ) {
      fail("Unable to calculate a valid order amount.", 409);
    }
    if (Math.round(input.expectedTotal * 100) !== totalCents) {
      fail(
        "Order subtotal or delivery fee changed. Review the total before placing your order.",
        409,
      );
    }
    const total = (totalCents / 100).toFixed(2);
    const orderId = await model.insertOrder({
      orderNumber,
      customerId: customer.customerId,
      paymentMethodId: methodId,
      fulfillment: input.fulfillment,
      subtotal: (subtotalCents / 100).toFixed(2),
      deliveryFee: (deliveryFeeCents / 100).toFixed(2),
      total,
      recipientName: input.recipientName,
      contactNumber: input.contactNumber,
      deliveryAddress:
        input.fulfillment === "DELIVERY" ? input.deliveryAddress : null,
      customerNotes: input.customerNotes,
      preferredSchedule: input.preferredSchedule
        ? `${input.preferredSchedule.replace("T", " ")}:00`
        : null,
    });
    await reserveAppointment(db, "ORDER", orderId, input.preferredSchedule);
    // Reserve actual free inventory atomically. Roll back the entire order
    // if any HP option has run out since the customer opened the Shop.
    await reserveForOrder(db, orderId, lines);
    for (const item of lines) {
      await model.insertItem(orderId, item);
    }
    await model.insertPayment(
      orderId,
      methodId,
      total,
      input.paymentCode === "CASH"
        ? "Cash collection to be arranged with the store."
        : `${input.paymentCode} selected. PayMongo Checkout will be available after staff confirms the order.`,
    );
    await model.insertStatus(orderId, userId);
    await createCustomerNotification(
      db,
      userId,
      "ORDER_PLACED",
      "Order received",
      `Your order ${orderNumber} has been submitted. Delivery and installation are awaiting store confirmation.`,
      `/account/orders/${orderNumber}`,
    );
    await workspaceModel(db).notifyStaff(
      "New online order",
      `Order ${orderNumber} was placed and needs staff review.`,
      ["OWNER", "MANAGER", "SALES_CASHIER"],
    );

    if (input.source === "CART") {
      for (const item of input.items) {
        const removed = await model.removeCheckedLine(
          cartId,
          item.variantId,
          item.quantity,
        );
        if (removed !== 1)
          fail("Cart was updated during checkout. Please retry.", 409);
      }
    }
    const [saved] = await loadOrders(model, customer.customerId, orderNumber);
    await db.commit();
    return { ...saved, replayed: false };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

export async function listCustomerOrders(userId) {
  const model = orderModel(connectDB);
  const customer = await model.customer(userId);
  if (!customer) fail("Active customer account required.", 403);
  return loadOrders(model, customer.customerId);
}

export async function getCustomerOrder(userId, orderNumber) {
  if (!/^AV-[0-9A-F]{32}$/.test(orderNumber)) fail("Invalid order number.");
  const model = orderModel(connectDB);
  const customer = await model.customer(userId);
  if (!customer) fail("Active customer account required.", 403);
  const [order] = await loadOrders(model, customer.customerId, orderNumber);
  if (!order) fail("Order not found.", 404);
  return order;
}

// Customer self-service: transactions recheck all restrictions under row locks.
// Never accept customer-supplied order status, price, or payment changes.

function validOrderNumber(orderNumber) {
  if (
    typeof orderNumber !== "string" ||
    !/^AV-[0-9A-F]{32}$/.test(orderNumber)
  ) {
    fail("Invalid online order reference.");
  }
  return orderNumber;
}

async function withEditableOrder(userId, orderNumber, work) {
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const model = orderModel(db);
    const customer = await model.customer(userId, true);
    if (!customer) fail("Active customer account required.", 403);

    const order = await model.lockCustomerOrder(
      customer.customerId,
      orderNumber,
    );
    if (!order) fail("Order not found.", 404);
    if (
      order.status !== "PENDING" ||
      order.paymentStatus !== "PENDING" ||
      order.channel !== "ONLINE" ||
      order.paymentCode !== "CASH"
    ) {
      fail(
        "This order can no longer be changed online. Please contact the store.",
        409,
      );
    }
    if (await model.hasWorkOrders(order.orderId)) {
      fail(
        "Staff have started preparing this order. Please contact the store.",
        409,
      );
    }
    const paymentStates = await model.lockPaymentStates(order.orderId);
    if (
      !paymentStates.length ||
      paymentStates.some((status) => status !== "PENDING")
    ) {
      fail(
        "The payment state has changed. Contact the store before editing.",
        409,
      );
    }

    await work(model, order, db);
    const [updated] = await loadOrders(model, customer.customerId, orderNumber);
    await db.commit();
    return updated;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

export async function editCustomerOrder(userId, orderNumber, input) {
  validOrderNumber(orderNumber);
  const details = validateOrderEdit(input);
  return withEditableOrder(
    userId,
    orderNumber,
    async (model, order, modelConnection) => {
      if (
        details.fulfillment !== order.fulfillment &&
        Number(order.deliveryFee) > 0
      ) {
        fail(
          "A delivery fee has already been applied. Contact the store to change fulfillment.",
          409,
        );
      }
      const normalized = {
        ...details,
        deliveryAddress:
          details.fulfillment === "DELIVERY" ? details.deliveryAddress : null,
        preferredSchedule: details.preferredSchedule
          ? `${details.preferredSchedule.replace("T", " ")}:00`
          : null,
      };

      const changedFields = [
        ["recipientName", "recipient"],
        ["contactNumber", "contact number"],
        ["fulfillment", "fulfillment method"],
        ["deliveryAddress", "delivery address"],
        ["customerNotes", "notes"],
        ["preferredSchedule", "preferred schedule"],
      ]
        .filter(([field]) => {
          const previous =
            field === "preferredSchedule"
              ? order.preferredSchedule || null
              : order[field] || null;
          const next =
            field === "preferredSchedule"
              ? details.preferredSchedule || null
              : normalized[field] || null;
          return previous !== next;
        })
        .map(([, label]) => label);

      if (!changedFields.length) return;
      await reserveAppointment(
        modelConnection,
        "ORDER",
        order.orderId,
        details.preferredSchedule,
      );
      await model.updateCustomerDetails(order.orderId, normalized);
      await model.addCustomerEvent(
        order.orderId,
        userId,
        "PENDING",
        "PENDING",
        `Customer updated: ${changedFields.join(", ")}.`,
      );
      await createCustomerNotification(
        modelConnection,
        userId,
        "ORDER_UPDATED",
        "Order details updated",
        `The details for order ${orderNumber} were updated successfully.`,
        `/account/orders/${orderNumber}`,
      );
    },
  );
}

export async function cancelCustomerOrder(userId, orderNumber, input) {
  validOrderNumber(orderNumber);
  const { reason, details } = validateOrderCancellation(input);
  const labels = {
    CHANGED_MIND: "Changed my mind",
    WRONG_DETAILS: "Wrong order details",
    ORDERED_BY_MISTAKE: "Ordered by mistake",
    OTHER: "Other reason",
  };
  return withEditableOrder(
    userId,
    orderNumber,
    async (model, order, modelConnection) => {
      const affected = await model.cancelPendingOrder(order.orderId);
      if (affected !== 1)
        fail("Order changed during cancellation. Refresh and retry.", 409);
      await model.cancelPendingPayments(order.orderId);
      await releaseOrderReservation(modelConnection, order.orderId);
      await releaseAppointment(modelConnection, "ORDER", order.orderId);
      const note = `Customer cancelled order: ${labels[reason]}${details ? `. ${details}` : ""}`;
      await model.addCustomerEvent(
        order.orderId,
        userId,
        "PENDING",
        "CANCELLED",
        note,
      );
      await createCustomerNotification(
        modelConnection,
        userId,
        "ORDER_CANCELLED",
        "Order cancelled",
        `Your order ${orderNumber} has been cancelled. No cash payment was collected.`,
        `/account/orders/${orderNumber}`,
      );
    },
  );
}
