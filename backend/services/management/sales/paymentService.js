import connectDB from "../../../utils/dbConn.js";
import { paymentModel } from "../../../models/management/sales/paymentModel.js";
import { orderModel } from "../../../models/management/sales/orderModel.js";

import { validateCashConfirmation } from "../../../validators/management/sales/paymentValidator.js";
import { randomUUID } from "node:crypto";
import { applyManagementEvent } from "../operations/operationsService.js";
import { fail, validStaff } from "./salesHelpers.js";

function paymentData(db) {
  // Cash collection also updates the related order payment status.
  return { ...paymentModel(db), ...orderModel(db) };
}

export async function getSalesPayments(staff) {
  validStaff(staff);
  return { payments: await paymentData(connectDB).payments() };
}
export async function confirmCollectedCash(staff, rawId, rawInput) {
  validStaff(staff);
  const paymentId = Number(rawId);
  if (!Number.isSafeInteger(paymentId) || paymentId < 1)
    fail("Invalid payment ID.");
  const input = validateCashConfirmation(rawInput);
  const payment =
    await paymentData(connectDB).paymentForConfirmation(paymentId);
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
