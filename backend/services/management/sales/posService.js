import connectDB from "../../../utils/dbConn.js";
import { ensureConfirmedWorkOrders } from "../services/confirmationWorkOrderService.js";
import { posModel } from "../../../models/management/sales/posModel.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { paymentModel } from "../../../models/management/sales/paymentModel.js";

import { validatePosSale } from "../../../validators/management/sales/posValidator.js";
import { fail, cents, peso, validStaff } from "./salesHelpers.js";

function posData(db) {
  // POS needs product stock/order operations and Cash payment recording together.
  return { ...posModel(db), ...paymentModel(db) };
}

export async function getPosCatalog(staff) {
  validStaff(staff);
  const model = posData(connectDB);
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
  if (
    input.technicianIds.length &&
    !["OWNER", "MANAGER"].includes(staff.role)
  ) {
    fail("Only an owner or manager may assign technicians.", 403);
  }
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
    const model = posData(connection);
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
      scheduledStart: input.scheduledStart,
      serviceAddress: input.serviceAddress,
    });
    if (input.scheduledStart)
      await reserveAppointment(
        connection,
        "ORDER",
        orderId,
        input.scheduledStart,
      );
    for (const item of lines) {
      const taken = await model.takeStock(item.variantId, item.quantity);
      if (taken !== 1)
        fail("Stock changed during checkout. Refresh POS and retry.", 409);
      await model.addItem(orderId, {
        ...item,
        installationIncluded: Boolean(input.scheduledStart),
      });
      await model.recordStockSale(item.variantId, item.quantity, staff.id);
    }
    await model.recordPayment(
      orderId,
      methodId,
      peso(total),
      staff.id,
      `Cash received: PHP ${peso(received)}; change: PHP ${peso(change)}.`,
    );
    await model.recordOrderHistory(
      orderId,
      staff.id,
      Boolean(input.scheduledStart),
    );
    if (input.scheduledStart) {
      await ensureConfirmedWorkOrders(
        connection,
        "ORDER",
        orderId,
        staff,
        input.technicianIds,
      );
    }
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
        appointment: input.scheduledStart,
      },
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      const previous = await posData(connectDB).previousPosSale(
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
