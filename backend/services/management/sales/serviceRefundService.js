import { randomUUID } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";

import { serviceRefundModel } from "../../../models/management/sales/serviceRefundModel.js";
import { serviceRequestModel } from "../../../models/management/services/serviceFulfillmentModel.js";
import { fulfillmentEventModel } from "../../../models/management/operations/fulfillmentEventModel.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { paymongoModel } from "../../../models/payments/paymongoModel.js";

import { validateServiceCashRefund } from "../../../validators/management/sales/serviceRefundValidator.js";

import { createCustomerNotification } from "../../customer/notification/notificationService.js";
import { cancelConfirmedWork } from "../services/confirmationWorkOrderService.js";
import { releaseAppointment } from "../../scheduling/bookingScheduleService.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

/**
 * Record a verified cash refund and cancel the associated
 * unstarted service within a single database transaction.
 */
export async function confirmServiceCashRefund(staff, rawPaymentId, raw) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only an Owner or Manager may record a refund.", 403);
  }

  const paymentId = Number(rawPaymentId);

  if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
    fail("Invalid service payment ID.", 400);
  }

  const input = validateServiceCashRefund(raw);

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = serviceRefundModel(db);

    const requestId = await model.requestIdForPayment(paymentId);

    if (!requestId) {
      fail("Service payment not found.", 404);
    }

    const service = await model.lockRequest(requestId);

    if (!service) {
      fail("Service request not found.", 404);
    }

    if (await model.existingRefund(paymentId)) {
      fail(
        "This refund has already been recorded. Do not return the money again.",
      );
    }

    if (!["PENDING", "CONFIRMED"].includes(service.status)) {
      fail("This service is not eligible for cancellation and refund.");
    }

    if (
      Number(service.hasStartEvent) === 1 ||
      Number(service.workStarted) === 1
    ) {
      fail(
        "Service work has already started. Management must reconcile the completed work separately.",
      );
    }

    const payment = await model.lockPayment(paymentId, requestId);

    if (!payment) {
      fail("Service payment not found.", 404);
    }

    if (payment.status !== "PAID") {
      fail("Only confirmed paid payments can be refunded.");
    }

    if (payment.method !== "CASH") {
      fail("Online payments require a verified payment-provider refund.");
    }

    if (Number(payment.amount) <= 0) {
      fail("Invalid refund amount.");
    }

    if (await paymongoModel(db).hasUnsettledCheckout("SERVICE", requestId)) {
      fail("Reconcile the unresolved online checkout before refunding.");
    }

    await cancelConfirmedWork(db, "SERVICE", requestId);

    await releaseAppointment(db, "SERVICE", requestId);

    const refundReference = `REFUND-SERVICE-${paymentId}`;

    const refundId = await model.recordCashRefund(
      payment,
      requestId,
      staff.id,
      refundReference,
      input.reason,
    );

    await serviceRequestModel(db).setServiceStatus(
      requestId,
      "CANCELLED",
      null,
    );

    await fulfillmentEventModel(db).addEvent({
      requestKey: randomUUID(),
      kind: "SERVICE",
      recordId: requestId,
      eventCode: "SERVICE_CANCELLED",
      staffId: staff.id,
      note: `Cash refund ${refundReference}: ${input.reason}`,
      schedule: null,
    });

    await model.auditRefund(staff.id, paymentId);

    await auditLogModel(db).audit(
      staff.id,
      "SERVICE_CANCELLED",
      "service-requests",
      requestId,
    );

    if (service.customerUserId) {
      await createCustomerNotification(
        db,
        service.customerUserId,
        "PAYMENT_REFUNDED",
        "Service cancelled and refunded",
        `Your service was cancelled and a cash refund of PHP ${Number(
          payment.amount,
        ).toFixed(2)} was recorded. Reference: ${refundReference}.`,
        `/account/services/${requestId}`,
      );
    }

    await db.commit();

    return {
      refundId,
      refundReference,
      requestId,
      serviceStatus: "CANCELLED",
      paymentStatus: "REFUNDED",
      message:
        "Service cancelled, cash refund recorded, and appointment released.",
    };
  } catch (error) {
    await db.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      fail("Refund already recorded. Refresh the payment details.");
    }

    throw error;
  } finally {
    db.release();
  }
}
