import { randomUUID } from "node:crypto";
import connectDB from "../../../utils/dbConn.js";
import { orderRefundModel } from "../../../models/management/sales/orderRefundModel.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { fulfillmentEventModel } from "../../../models/management/operations/fulfillmentEventModel.js";
import { paymongoModel } from "../../../models/payments/paymongoModel.js";
import { notificationModel } from "../../../models/customer/notification/notificationModel.js";
import { validateOrderCashRefund } from "../../../validators/management/sales/orderRefundValidator.js";
import { cancelConfirmedWork } from "../services/confirmationWorkOrderService.js";
import { releaseOrderReservation } from "../../customer/order/stockReservationService.js";
import { releaseAppointment } from "../../scheduling/bookingScheduleService.js";
import { createCustomerNotification } from "../../customer/notification/notificationService.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

export async function confirmOrderCashRefund(staff, rawId, raw) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only an Owner or Manager may record a refund.", 403);
  }

  const paymentId = Number(rawId);

  if (!Number.isSafeInteger(paymentId) || paymentId < 1) {
    fail("Invalid payment ID.", 400);
  }

  const input = validateOrderCashRefund(raw);
  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = orderRefundModel(db);

    const orderId = await model.orderIdForPayment(paymentId);

    if (!orderId) {
      fail("Payment not found.", 404);
    }

    const order = await model.lockOrder(orderId);

    if (!order) {
      fail("Order not found.", 404);
    }

    const prior = await model.existing(paymentId);

    if (prior) {
      await db.commit();

      return {
        ...prior,
        alreadyRecorded: true,
        message: "Refund already recorded. Do not return the funds again.",
      };
    }

    if (
      order.paymentStatus !== "PAID" ||
      !["PENDING", "CONFIRMED", "SCHEDULED"].includes(order.status)
    ) {
      fail("Only paid, unstarted orders may use this cancellation refund.");
    }

    const payments = await model.lockPayments(orderId);
    const payment = payments[0];

    if (
      payments.length !== 1 ||
      Number(payment.id) !== paymentId ||
      payment.status !== "PAID" ||
      !payment.paidAt ||
      Number(payment.amount) <= 0 ||
      Number(payment.amount) !== Number(order.total)
    ) {
      fail("Reconcile the payment amount and records before refunding.");
    }

    if (payment.method !== "CASH") {
      fail(
        "Online payments must be refunded and verified through the payment provider.",
      );
    }

    if (await paymongoModel(db).hasUnsettledCheckout("ORDER", orderId)) {
      fail("Reconcile the unresolved online checkout first.");
    }

    const events = fulfillmentEventModel(db);

    if (await events.hasEvent("ORDER", orderId, "ORDER_OUT_FOR_DELIVERY")) {
      fail("Products have been dispatched. Use a verified return workflow.");
    }

    await cancelConfirmedWork(db, "ORDER", orderId);

    if (!(await releaseOrderReservation(db, orderId))) {
      fail(
        "No active stock reservation. Reconcile physical stock before refunding this older or dispatched order.",
      );
    }

    await releaseAppointment(db, "ORDER", orderId);

    const reference = `REFUND-ORDER-${paymentId}`;

    const refundId = await model.record(
      payment,
      orderId,
      staff.id,
      reference,
      input.reason,
    );

    if (!(await model.cancelPaidOrder(orderId, paymentId))) {
      fail("Order or payment changed. Refresh and retry.");
    }

    const note = `Cash refund ${reference}: ${input.reason}`;

    await model.history(order, staff.id, note);

    await events.addEvent({
      requestKey: randomUUID(),
      kind: "ORDER",
      recordId: orderId,
      eventCode: "ORDER_CANCELLED_BY_STAFF",
      staffId: staff.id,
      note,
      schedule: null,
    });

    await auditLogModel(db).audit(
      staff.id,
      "CONFIRM_ORDER_CASH_REFUND",
      "payments",
      paymentId,
    );

    if (
      order.userId &&
      (await notificationModel(db).activeCustomer(order.userId))
    ) {
      await createCustomerNotification(
        db,
        order.userId,
        "PAYMENT_REFUNDED",
        "Order cancelled and refunded",
        `Cash refund of PHP ${Number(payment.amount).toFixed(2)} recorded. Reference: ${reference}. Reason: ${input.reason}`,
        `/account/orders/${order.reference}`,
      );
    }

    await db.commit();

    return {
      refundId,
      refundReference: reference,
      message:
        "Order cancelled, cash refund recorded, and stock and appointment released.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
