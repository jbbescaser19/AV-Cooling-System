import { createHash, randomUUID } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";

import { priceAdjustmentModel } from "../../../models/management/pricing/priceAdjustmentModel.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { fulfillmentEventModel } from "../../../models/management/operations/fulfillmentEventModel.js";
import { orderModel } from "../../../models/management/sales/orderFulfillmentModel.js";

import { createCustomerNotification } from "../../customer/notification/notificationService.js";

import { validatePriceAdjustment } from "../../../validators/management/pricing/priceAdjustmentValidator.js";

import { fail } from "../operations/eventHelpers.js";

function authorize(staff, kind, rawId) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Owner or Manager access required.", 403);
  }

  const id = Number(rawId);

  if (
    !["ORDER", "SERVICE"].includes(kind) ||
    !/^[1-9]\d*$/.test(String(rawId)) ||
    !Number.isSafeInteger(id)
  ) {
    fail("Invalid record ID.", 400);
  }

  return id;
}

const cents = (value) => Math.round(Number(value) * 100);

const peso = (value) => (value / 100).toFixed(2);

export function calculateAdjustedTotal(base, delivery, discount, fee) {
  if (
    ![base, delivery, discount, fee].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  ) {
    fail("Invalid price amounts.", 400);
  }

  if (discount > 0 && discount >= base) {
    fail("Discount must be less than the base price.", 400);
  }

  const total = base + delivery - discount + fee;

  if (total <= 0 || total > 999999999999) {
    fail("Final total must be positive and within the allowed amount.", 400);
  }

  return total;
}

async function load(model, kind, id, lock = false) {
  const row = await model.record(kind, id, lock);

  if (!row) {
    fail("Record not found.", 404);
  }

  const payments = await model.payments(kind, id, lock);

  const payment = payments.length === 1 ? payments[0] : null;

  let blockedReason = "";

  if (!Number(row.online)) {
    blockedReason =
      "Use the original POS or Facebook transaction. Only pending online requests can be adjusted here.";
  } else if (
    row.status !== "PENDING" ||
    row.parentPaymentStatus !== "PENDING"
  ) {
    blockedReason = "Price is locked after confirmation or payment.";
  } else if (
    !payment ||
    payment.status !== "PENDING" ||
    cents(payment.amount) !== cents(row.total)
  ) {
    blockedReason = "A matching unpaid payment record is required.";
  } else if (
    payment.transferReference ||
    (kind === "ORDER" && (await model.hasTransferClaim(payment.id, lock)))
  ) {
    blockedReason = "A payment reference already exists.";
  } else if (await model.hasPaymentLink(kind, payment.id, lock)) {
    blockedReason = "A PayMongo checkout already exists.";
  } else if (await model.hasWork(kind, id, lock)) {
    blockedReason = "This record already has assigned or scheduled work.";
  }

  const pricing = {
    base: peso(cents(row.base)),

    deliveryFee: peso(cents(row.deliveryFee)),

    discount: peso(cents(row.discount)),

    discountReason: row.discountReason || "",

    additionalFee: peso(cents(row.additionalFee)),

    additionalFeeReason: row.additionalFeeReason || "",

    total: peso(cents(row.total)),

    editable: !blockedReason,

    blockedReason,
  };

  pricing.version = createHash("sha256")
    .update(
      JSON.stringify([
        pricing,
        row.id,
        row.status,
        row.parentPaymentStatus,
        payment?.id,
        payment?.status,
        payment?.amount,
      ]),
    )
    .digest("hex");

  return {
    row,
    payment,
    pricing,
  };
}

export async function getPriceAdjustment(kind, rawId, staff) {
  const id = authorize(staff, kind, rawId);

  return {
    pricing: (await load(priceAdjustmentModel(connectDB), kind, id)).pricing,
  };
}

export async function updatePriceAdjustment(kind, rawId, staff, raw) {
  const id = authorize(staff, kind, rawId);

  const input = validatePriceAdjustment(raw);

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = priceAdjustmentModel(connection);

    const { row, payment, pricing } = await load(model, kind, id, true);

    if (!pricing.editable) {
      fail(pricing.blockedReason);
    }

    if (input.expectedVersion !== pricing.version) {
      fail("The price has changed. Reload the current amounts before editing.");
    }

    const discount = cents(input.discount);

    const fee = cents(input.additionalFee);

    const total = calculateAdjustedTotal(
      cents(pricing.base),
      cents(pricing.deliveryFee),
      discount,
      fee,
    );

    const next = {
      discount: peso(discount),

      discountReason: input.discountReason,

      additionalFee: peso(fee),

      additionalFeeReason: input.additionalFeeReason,

      total: peso(total),
    };

    if (
      next.discount === pricing.discount &&
      next.discountReason === pricing.discountReason &&
      next.additionalFee === pricing.additionalFee &&
      next.additionalFeeReason === pricing.additionalFeeReason
    ) {
      await connection.commit();

      return {
        pricing,
        message: "No price changes were needed.",
      };
    }

    await model.save(kind, id, payment.id, next);

    const note =
      `Agreed price updated: PHP ${pricing.total} to PHP ${next.total}. ` +
      `Discount: PHP ${next.discount}. ` +
      (next.discountReason ? `Discount reason: ${next.discountReason}. ` : "") +
      `Additional fee: PHP ${next.additionalFee}.` +
      (next.additionalFeeReason ? ` Reason: ${next.additionalFeeReason}.` : "");

    await fulfillmentEventModel(connection).addEvent({
      requestKey: randomUUID(),
      kind,
      recordId: id,
      eventCode: "PRICE_ADJUSTED",
      staffId: staff.id,
      note,
      schedule: null,
    });

    if (kind === "ORDER") {
      await orderModel(connection).addOrderHistory(
        id,
        row.status,
        row.status,
        staff.id,
        note,
      );
    }

    await auditLogModel(connection).audit(
      staff.id,
      "PRICE_ADJUSTED",
      kind === "ORDER" ? "orders" : "service-requests",
      id,
    );

    if (row.customerUserId) {
      await createCustomerNotification(
        connection,
        row.customerUserId,
        "PRICE_ADJUSTED",
        "Agreed price updated",
        note,
        kind === "ORDER"
          ? `/account/orders/${row.reference}`
          : `/account/services/${id}`,
      );
    }

    const updated = await load(model, kind, id, true);

    await connection.commit();

    return {
      pricing: updated.pricing,

      message: "Price and pending payment updated.",
    };
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}
