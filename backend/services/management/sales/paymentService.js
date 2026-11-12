import { servicePaymentModel } from "../../../models/management/sales/servicePaymentModel.js";
import { createCustomerNotification } from "../../customer/notification/notificationService.js";
import { validateManualTransferConfirmation } from "../../../validators/management/sales/manualTransferValidator.js";
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

/** Manual transfer reconciliation: only OWNER/MANAGER may mark externally verified funds paid. */
export async function confirmManualTransfer(staff, rawId, rawInput) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role))
    fail("Owner or Manager access required.", 403);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) fail("Invalid payment ID.", 400);
  const input = validateManualTransferConfirmation(rawInput);
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = paymentModel(connection);
    const payment = await model.manualPaymentForUpdate(id);
    if (!payment) fail("Payment not found.", 404);
    if (
      !["GCASH", "BANK_TRANSFER"].includes(payment.method) ||
      payment.channel !== "ONLINE"
    )
      fail("Only online manual transfers can be reconciled here.", 409);
    if (
      !["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
        payment.orderStatus,
      )
    )
      fail("Confirm the order before marking it paid.", 409);
    if (
      payment.status !== "PENDING" ||
      payment.orderPaymentStatus !== "PENDING"
    )
      fail("Payment is no longer pending.", 409);
    if (
      !payment.transferReference ||
      payment.transferReference !== input.reference
    )
      fail(
        "Transaction reference does not match the customer submission.",
        409,
      );
    // No automatic trust in customer screenshots or typed references. Staff must
    // verify funds and exact amount directly in the actual GCash/bank statement.
    if (
      (await model.confirmManualPayment(
        id,
        staff.id,
        `Externally verified ${payment.method} reference ${input.reference}. ${input.note}`,
      )) !== 1
    )
      fail("Payment changed; refresh.", 409);
    if ((await model.confirmManualOrder(payment.orderId)) !== 1)
      fail("Order payment changed; refresh.", 409);
    await model.auditManualPayment(staff.id, id);
    await createCustomerNotification(
      connection,
      payment.customerUserId,
      "PAYMENT_CONFIRMED",
      "Payment verified",
      `Payment for ${payment.orderNumber} was verified by Management.`,
      `/account/orders/${payment.orderNumber}`,
    );
    await connection.commit();
    return { message: "Payment recorded as PAID after external verification." };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
