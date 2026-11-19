import { getDeliveryFee } from "../../shared/deliveryPricingService.js";
import connectDB from "../../../utils/dbConn.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { ensureConfirmedWorkOrders } from "../services/confirmationWorkOrderService.js";
import { posModel } from "../../../models/management/sales/posModel.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { paymentModel } from "../../../models/management/sales/paymentModel.js";
import { paymentMethodModel } from "../../../models/customer/order/paymentMethodModel.js";
import { paymongoConfigured } from "../../payments/paymongoService.js";
import { reserveForOrder } from "../../customer/order/stockReservationService.js";
import { notifyPhysicalStockCrossing } from "../catalog/lowStockService.js";
import { validatePosSale } from "../../../validators/management/sales/posValidator.js";
import { fail, cents, peso, validStaff } from "./salesHelpers.js";

function posData(db) {
  return {
    ...posModel(db),
    ...paymentModel(db),
  };
}

export async function searchPosCustomers(staff, rawQuery) {
  validStaff(staff);

  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  const minLength = /^\d+$/.test(query) ? 4 : 3;

  if (query.length < minLength || query.length > 80) {
    fail(`Search by at least ${minLength} characters (max 80).`, 400);
  }

  const pattern = `%${query.replace(/[!%_]/g, "!$&")}%`;

  return {
    items: await posModel(connectDB).searchReturningCustomers(pattern),
  };
}

export async function getPosCatalog(staff) {
  validStaff(staff);

  const model = posData(connectDB);

  const [items, cashMethodId] = await Promise.all([
    model.catalog(),
    model.cashMethod(),
  ]);

  const enabled = await paymentMethodModel(connectDB).enabledMethods();

  return {
    paymentMethods: enabled.filter(
      (code) => code === "CASH" || paymongoConfigured(),
    ),

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
    if (duplicateIds.has(item.variantId)) {
      fail("Duplicate product variants are not allowed.");
    }

    duplicateIds.add(item.variantId);
    itemCount += item.quantity;
  }

  if (itemCount > 99) {
    fail("A single sale cannot exceed 99 items.");
  }

  const isCash = input.paymentCode === "CASH";
  const cashPaid = isCash && !input.payLater;

  if (!isCash && !paymongoConfigured()) {
    fail(
      "PayMongo needs merchant setup before accepting online payments.",
      503,
    );
  }

  if (!isCash && input.cashReceived > 0) {
    fail("Do not enter cash received for a PayMongo transaction.", 400);
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = posData(connection);

    const previous = await model.previousPosSale(orderNumber, staff.id);

    if (previous) {
      await connection.commit();

      return {
        receipt: previous,
        alreadySaved: true,
      };
    }

    const methodId = await model.enabledMethod(input.paymentCode);

    if (!methodId) {
      fail("The selected payment method is unavailable.", 409);
    }

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

      if (!(Number(product.horsepower) > 0)) {
        fail("Select a valid horsepower variant.", 400);
      }

      if (
        !product.inventoryId ||
        Number(product.onHand) - Number(product.reserved) < item.quantity
      ) {
        fail(`Not enough stock for ${product.productName}.`, 409);
      }

      const unit = cents(product.price);

      if (unit <= 0) {
        fail("A selected product has an invalid price.", 409);
      }

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
    const additionalFee = cents(input.additionalFee);
    const received = cents(input.cashReceived);

    if (discount >= subtotal) {
      fail("Discount must be less than the sale subtotal.");
    }

    if (
      input.delivery &&
      input.deliveryArea === "OTHER" &&
      additionalFee <= 0
    ) {
      fail(
        "Enter an agreed additional delivery fee and a reason for this location.",
        400,
      );
    }

    const deliveryFee = input.delivery
      ? input.deliveryArea === "OTHER"
        ? 0
        : cents(getDeliveryFee(input.deliveryArea, input.serviceAddress))
      : 0;

    const total = subtotal - discount + deliveryFee + additionalFee;

    if (total <= 0 || (cashPaid && received < total)) {
      fail(
        isCash ? "Cash received must cover the total." : "Invalid order total.",
      );
    }

    const change = cashPaid ? received - total : 0;

    const orderId = await model.createOrder({
      orderNumber,
      staffId: staff.id,
      methodId,
      paid: cashPaid,
      paymentCode: input.paymentCode,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      subtotal: peso(subtotal),
      discount: peso(discount),
      discountReason: input.discountReason,
      additionalFee: peso(additionalFee),
      additionalFeeReason: input.additionalFeeReason,
      deliveryFee: peso(deliveryFee),
      total: peso(total),
      installationIncluded: input.installationIncluded,
      scheduledStart: input.scheduledStart,
      serviceAddress: input.serviceAddress,
    });

    if (input.scheduledStart) {
      await reserveAppointment(
        connection,
        "ORDER",
        orderId,
        input.scheduledStart,
      );
    }

    const takeStockNow = cashPaid && !input.scheduledStart;

    for (const item of lines) {
      if (takeStockNow) {
        const taken = await model.takeStock(item.variantId, item.quantity);

        if (taken !== 1) {
          fail("Stock changed during checkout. Refresh POS and retry.", 409);
        }
      }

      await model.addItem(orderId, {
        ...item,
        installationIncluded: input.installationIncluded,
      });

      if (takeStockNow) {
        await model.recordStockSale(item.variantId, item.quantity, staff.id);

        await notifyPhysicalStockCrossing(
          connection,
          item.variantId,
          item.quantity,
        );
      }
    }

    if (!takeStockNow) {
      await reserveForOrder(connection, orderId, lines);
    }

    await model.recordPayment(
      orderId,
      methodId,
      peso(total),
      staff.id,
      cashPaid
        ? `Cash received: PHP ${peso(received)}; change: PHP ${peso(change)}.`
        : isCash
          ? "Cash payment pending; Pay Later selected."
          : "Payment pending via secure PayMongo Checkout.",
      cashPaid,
    );

    await model.recordOrderHistory(
      orderId,
      staff.id,
      Boolean(input.scheduledStart),
      input.installationIncluded,
      cashPaid,
      input.paymentCode,
    );

    await auditLogModel(connection).audit(
      staff.id,
      cashPaid
        ? "CONFIRM_POS_CASH"
        : isCash
          ? "CREATE_POS_CASH_PENDING"
          : "CREATE_POS_PAYMONGO_PENDING",
      "orders",
      orderId,
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

    const saved = await model.previousPosSale(orderNumber, staff.id);

    if (!saved?.reference) {
      fail("Saved order reference could not be read.", 500);
    }

    const paymentId = saved.paymentId;

    await connection.commit();

    return {
      alreadySaved: false,

      receipt: {
        id: orderId,
        orderNumber,
        reference: saved.reference,
        customer: input.customerName,
        contact: input.customerPhone,
        items: lines,
        subtotal: peso(subtotal),
        discount: peso(discount),
        discountReason: input.discountReason,
        additionalFee: peso(additionalFee),
        additionalFeeReason: input.additionalFeeReason,
        deliveryFee: peso(deliveryFee),
        total: peso(total),
        cashReceived: cashPaid ? peso(received) : null,
        change: cashPaid ? peso(change) : null,
        paymentStatus: cashPaid ? "PAID" : "PENDING",
        method: input.paymentCode,
        paymentId,
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

      if (previous) {
        return {
          receipt: previous,
          alreadySaved: true,
        };
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
