import { randomUUID } from "node:crypto";
import connectDB from "../../utils/dbConn.js";
import { salesModel } from "../../models/management/salesModel.js";
import {
  validatePosSale,
  validateCashConfirmation,
} from "../../validators/management/salesValidator.js";
import { applyManagementEvent } from "./operationsService.js";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

// Money is calculated in integer centavos, never floating-point totals.
function cents(value) {
  const text = String(value);
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(text)) {
    fail("Invalid money amount.");
  }
  const [whole, part = ""] = text.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
function peso(amount) {
  return (amount / 100).toFixed(2);
}
function validStaff(staff) {
  if (!["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff?.role)) {
    fail("Sales access is required.", 403);
  }
}

export async function getPosCatalog(staff) {
  validStaff(staff);
  const model = salesModel(connectDB);
  const [items, cashMethodId] = await Promise.all([
    model.catalog(),
    model.cashMethod(),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      variantId: Number(item.variantId),
      price: Number(item.price),
      available: Number(item.available),
    })),
    cashAvailable: Boolean(cashMethodId),
  };
}

export async function createPosSale(staff, raw) {
  validStaff(staff);
  const input = validatePosSale(raw);
  const orderNumber = `POS-${input.requestKey.replaceAll("-", "").toUpperCase()}`;
  const duplicateIds = new Set();
  let itemCount = 0;
  for (const item of input.items) {
    if (duplicateIds.has(item.variantId))
      fail("Duplicate product variants are not allowed.");
    duplicateIds.add(item.variantId);
    itemCount += item.quantity;
  }
  if (itemCount > 99) fail("A single sale cannot exceed 99 items.");
  if (input.discount > 0 && !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only an owner or manager can apply a discount.", 403);
  }

  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = salesModel(connection);
    const previous = await model.previousPosSale(orderNumber, staff.id);
    if (previous) {
      await connection.commit();
      return { receipt: previous, alreadySaved: true };
    }
    const methodId = await model.cashMethod();
    if (!methodId)
      fail("Enable the CASH payment method before using POS.", 409);

    const lines = [];
    let subtotal = 0;
    for (const item of [...input.items].sort(
      (a, b) => a.variantId - b.variantId,
    )) {
      const product = await model.lockVariant(item.variantId);
      if (
        !product ||
        product.productStatus !== "ACTIVE" ||
        product.variantStatus !== "ACTIVE"
      ) {
        fail("A selected product is no longer available.", 409);
      }
      if (
        !product.inventoryId ||
        Number(product.onHand) - Number(product.reserved) < item.quantity
      ) {
        fail(`Not enough stock for ${product.productName}.`, 409);
      }
      const unit = cents(product.price);
      if (unit <= 0) fail("A selected product has an invalid price.", 409);
      const lineTotal = unit * item.quantity;
      subtotal += lineTotal;
      lines.push({
        variantId: item.variantId,
        productName: product.productName,
        model: product.model,
        horsepower: product.horsepower,
        quantity: item.quantity,
        unitPrice: peso(unit),
        lineTotal: peso(lineTotal),
      });
    }

    const discount = cents(input.discount);
    const received = cents(input.cashReceived);
    if (discount >= subtotal)
      fail("Discount must be less than the sale subtotal.");
    const total = subtotal - discount;
    if (total <= 0 || received < total)
      fail("Cash received must cover the total.");
    const change = received - total;

    const orderId = await model.createOrder({
      orderNumber,
      staffId: staff.id,
      methodId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      subtotal: peso(subtotal),
      discount: peso(discount),
      total: peso(total),
    });
    for (const item of lines) {
      const taken = await model.takeStock(item.variantId, item.quantity);
      if (taken !== 1)
        fail("Stock changed during checkout. Refresh POS and retry.", 409);
      await model.addItem(orderId, item);
      await model.recordStockSale(item.variantId, item.quantity, staff.id);
    }
    await model.recordPayment(
      orderId,
      methodId,
      peso(total),
      staff.id,
      `Cash received: PHP ${peso(received)}; change: PHP ${peso(change)}.`,
    );
    await model.recordOrderHistory(orderId, staff.id);
    await connection.commit();
    return {
      alreadySaved: false,
      receipt: {
        id: orderId,
        orderNumber,
        customer: input.customerName,
        items: lines,
        subtotal: peso(subtotal),
        discount: peso(discount),
        total: peso(total),
        cashReceived: peso(received),
        change: peso(change),
        paymentStatus: "PAID",
        method: "CASH",
      },
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      const previous = await salesModel(connectDB).previousPosSale(
        orderNumber,
        staff.id,
      );
      if (previous) return { receipt: previous, alreadySaved: true };
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function getSalesOrders(staff) {
  validStaff(staff);
  return { orders: await salesModel(connectDB).orders() };
}
export async function getSalesOrderDetails(staff, rawId) {
  validStaff(staff);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) fail("Invalid order ID.");
  const model = salesModel(connectDB);
  const order = await model.orderDetails(id);
  if (!order) fail("Order not found.", 404);
  return { order: { ...order, items: await model.orderItems(id) } };
}
export async function getSalesPayments(staff) {
  validStaff(staff);
  return { payments: await salesModel(connectDB).payments() };
}
export async function confirmCollectedCash(staff, rawId, rawInput) {
  validStaff(staff);
  const paymentId = Number(rawId);
  if (!Number.isSafeInteger(paymentId) || paymentId < 1)
    fail("Invalid payment ID.");
  const input = validateCashConfirmation(rawInput);
  const payment = await salesModel(connectDB).paymentForConfirmation(paymentId);
  if (!payment) fail("Payment not found.", 404);
  if (
    payment.method !== "CASH" ||
    !["ONLINE", "FACEBOOK"].includes(payment.channel)
  ) {
    fail("Only pending cash payments can be confirmed here.", 409);
  }
  if (payment.status !== "PENDING") fail("Payment is no longer pending.", 409);
  if (payment.channel === "FACEBOOK") {
    const connection = await connectDB.getConnection();
    try {
      await connection.beginTransaction();
      const model = salesModel(connection);
      const locked = await model.facebookPaymentForUpdate(paymentId);
      if (
        !locked ||
        locked.channel !== "FACEBOOK" ||
        locked.method !== "CASH" ||
        locked.paymentStatus !== "PENDING" ||
        locked.orderPaymentStatus !== "PENDING" ||
        !["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
          locked.orderStatus,
        )
      )
        fail("This Facebook payment cannot be confirmed.", 409);
      if (
        (await model.confirmFacebookCash(
          paymentId,
          staff.id,
          input.note || "Cash received and verified by management.",
        )) !== 1
      )
        fail("Payment changed; refresh the page.", 409);
      if ((await model.confirmFacebookOrder(locked.orderId)) !== 1)
        fail("Order payment changed; refresh the page.", 409);
      await model.auditCashCollection(staff.id, paymentId);
      await connection.commit();
      return { message: "Facebook cash payment recorded as PAID." };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  // Reuse the existing transactional event workflow so customers are notified.
  return applyManagementEvent("ORDER", payment.orderNumber, staff, {
    requestKey: randomUUID(),
    eventCode: "PAYMENT_CONFIRMED",
    paymentVerified: input.cashCollected,
    note: input.note || "Cash received and checked at the store.",
    schedule: null,
  });
}
