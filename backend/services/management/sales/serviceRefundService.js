import connectDB from "../../../utils/dbConn.js";
import { serviceRefundModel } from "../../../models/management/sales/serviceRefundModel.js";
import { validateServiceCashRefund } from "../../../validators/management/sales/serviceRefundValidator.js";
import { createCustomerNotification } from "../../customer/notification/notificationService.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

/** Record a refund ALREADY physically handed to the customer.
 * This does not perform a financial transfer or change the original PAID record.
 * Only one full-value cash refund may be recorded for a given payment.
 */
export async function confirmServiceCashRefund(staff, rawPaymentId, raw) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only an Owner or Manager may record a completed refund.", 403);
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
    if (!requestId) fail("Service payment not found.", 404);

    // Lock service first: matches the lock order of service cancellation.
    const service = await model.lockRequest(requestId);
    if (!service) fail("Service request not found.", 404);
    if (!["PENDING", "CONFIRMED"].includes(service.status)) {
      fail("This service is no longer eligible for a cancellation refund.");
    }
    if (service.hasStartEvent || service.workStarted) {
      fail(
        "Service work has started. A Manager must reconcile the work before a refund and cancellation.",
      );
    }

    const payment = await model.lockPayment(paymentId, requestId);
    if (!payment) fail("Service payment not found.", 404);
    if (payment.status !== "PAID") {
      fail("Only a confirmed paid payment can be recorded as refunded.");
    }
    if (payment.method !== "CASH") {
      fail(
        "Online payments require a separate verified payment-provider refund. Do not record those as cash refunds.",
      );
    }
    if (Number(payment.amount) <= 0) {
      fail(
        "Invalid paid amount. Review the payment before recording a refund.",
      );
    }
    if (await model.existingRefund(paymentId)) {
      fail(
        "This refund is already recorded. Do not refund the same payment twice.",
      );
    }
    const refundId = await model.recordCashRefund(
      payment,
      requestId,
      staff.id,
      input.receiptReference,
      input.reason,
    );
    await model.auditRefund(staff.id, paymentId);
    if (service.customerUserId) {
      await createCustomerNotification(
        db,
        service.customerUserId,
        "PAYMENT_REFUNDED",
        "Cash refund recorded",
        `AV Cooling recorded a cash refund of PHP ${Number(payment.amount).toFixed(2)} for Service #${requestId}. Reference: ${input.receiptReference}.`,
        `/account/services/${requestId}`,
      );
    }
    await db.commit();
    return {
      message: `Cash refund for Service #${requestId} was recorded. You may now cancel the request if no work has started.`,
      refundId,
    };
  } catch (error) {
    await db.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      fail("Refund was already recorded. Refresh the payment details.");
    }
    throw error;
  } finally {
    db.release();
  }
}
