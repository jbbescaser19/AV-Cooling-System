import { posCashPaymentModel } from "../../../models/management/sales/posCashPaymentModel.js";
import { ensureOrderStockDispatched } from "../../customer/order/stockReservationService.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { servicePaymentModel } from "../../../models/management/sales/servicePaymentModel.js";
import connectDB from "../../../utils/dbConn.js";
import { paymentModel } from "../../../models/management/sales/paymentModel.js";
import { orderModel } from "../../../models/management/sales/orderModel.js";
import { validateCashConfirmation } from "../../../validators/management/sales/paymentValidator.js";
import { randomUUID } from "node:crypto";
import { applyManagementEvent } from "../operations/operationsService.js";
import { fail, validStaff, cents } from "./salesHelpers.js";

function paymentData(db) {
  return {
    ...paymentModel(db),
    ...orderModel(db),
  };
}

export async function getSalesPayments(staff) {
  validStaff(staff);

  const [orders, services] = await Promise.all([
    paymentData(connectDB).payments(),
    servicePaymentModel(connectDB).list(),
  ]);

  return {
    payments: [...orders, ...services].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    ),
  };
}

export async function confirmCollectedCash(staff, rawId, rawInput) {
  validStaff(staff);

  const paymentId = Number(rawId);

  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    fail("Invalid payment ID.");
  }

  const input = validateCashConfirmation(rawInput);

  const payment =
    await paymentData(connectDB).paymentForConfirmation(paymentId);

  if (!payment) {
    fail("Payment not found.", 404);
  }

  if (
    payment.method !== "CASH" ||
    !["ONLINE", "FACEBOOK", "POS"].includes(payment.channel)
  ) {
    fail("Only pending cash payments can be confirmed here.", 409);
  }

  if (payment.channel === "POS") {
    if (!["OWNER", "MANAGER"].includes(staff.role)) {
      fail("Management access required.", 403);
    }

    return confirmPosCash(staff, paymentId, payment.orderNumber, input);
  }

  if (payment.status !== "PENDING") {
    fail("Payment is no longer pending.", 409);
  }

  if (payment.channel === "FACEBOOK") {
    const connection = await connectDB.getConnection();

    try {
      await connection.beginTransaction();

      const model = paymentData(connection);

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
      ) {
        fail("This Facebook payment cannot be confirmed.", 409);
      }

      if (
        (await model.confirmFacebookCash(
          paymentId,
          staff.id,
          input.note || "Cash received and verified by management.",
        )) !== 1
      ) {
        fail("Payment changed; refresh the page.", 409);
      }

      if ((await model.confirmFacebookOrder(locked.orderId)) !== 1) {
        fail("Order payment changed; refresh the page.", 409);
      }

      await model.auditCashCollection(staff.id, paymentId);

      await connection.commit();

      return {
        message: "Facebook cash payment recorded as PAID.",
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return applyManagementEvent("ORDER", payment.orderNumber, staff, {
    requestKey: randomUUID(),
    eventCode: "PAYMENT_CONFIRMED",
    paymentVerified: input.cashCollected,
    note: input.note || "Cash received and checked at the store.",
    schedule: null,
  });
}

async function confirmPosCash(staff, paymentId, reference, input) {
  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = posCashPaymentModel(db);

    const order = await model.lockOrder(reference);

    if (!order) {
      fail("POS order not found.", 404);
    }

    const payments = await model.lockPayments(order.id);
    const payment = payments[0];

    if (
      payments.length !== 1 ||
      Number(payment.id) !== paymentId ||
      payment.method !== "CASH" ||
      cents(payment.amount) !== cents(order.total)
    ) {
      fail("Reconcile this POS payment first.", 409);
    }

    if (order.paymentStatus === "PAID" && payment.status === "PAID") {
      if (order.fulfillment === "PICKUP" && order.status !== "COMPLETED") {
        fail("Paid pickup needs management reconciliation.", 409);
      }

      await db.commit();

      return {
        alreadyRecorded: true,
        message: "Cash payment already recorded.",
      };
    }

    if (
      order.paymentStatus !== "PENDING" ||
      payment.status !== "PENDING" ||
      !["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
        order.status,
      )
    ) {
      fail("This POS payment cannot be confirmed.", 409);
    }

    const pickup = order.fulfillment === "PICKUP";

    if (pickup && (order.status !== "CONFIRMED" || !input.pickupReleased)) {
      fail(
        "Confirm that the pickup products have actually been handed over before recording this payment.",
        409,
      );
    }

    const note = input.note || "Cash received and verified by management.";

    if (!(await model.markPaid(order.id, paymentId, staff.id, note))) {
      fail("Payment changed; refresh and retry.", 409);
    }

    if (pickup) {
      await ensureOrderStockDispatched(db, order.id, staff.id);

      if (!(await model.completePickup(order.id, staff.id))) {
        fail("Pickup status changed; refresh and retry.", 409);
      }
    }

    await auditLogModel(db).audit(
      staff.id,
      "CONFIRM_POS_CASH",
      "payments",
      paymentId,
    );

    await db.commit();

    return {
      message: "POS cash payment recorded as PAID.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
