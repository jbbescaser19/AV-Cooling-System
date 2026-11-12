import connectDB from "../../../utils/dbConn.js";
import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";
import { paymentInstructions } from "../order/manualPaymentService.js";
import { validateTransferReference } from "../../../validators/customer/order/transferValidator.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function assertServicePaymentAvailable(code) {
  if (!["CASH", "GCASH", "BANK_TRANSFER"].includes(code))
    fail("Choose a valid payment method.");
  if (!paymentInstructions(code).available)
    fail("This payment method is not configured by the store.", 409);
  return code;
}
export async function listMyServicePayments(userId) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1)
    fail("Invalid session.", 401);
  return {
    payments: await servicePaymentModel(connectDB).customerPayments(userId),
  };
}
export async function submitServiceTransfer(userId, rawId, raw) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) fail("Invalid service reference.");
  const { reference } = validateTransferReference(raw);
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const model = servicePaymentModel(db);
    const payment = await model.lockOwnedRequest(userId, id);
    if (!payment) fail("Service payment not found.", 404);
    if (!["GCASH", "BANK_TRANSFER"].includes(payment.method))
      fail("This service is not paid by transfer.", 409);
    if (payment.status !== "PENDING" || payment.serviceStatus === "CANCELLED")
      fail("This service cannot accept a transfer reference.", 409);
    if (payment.transferReference)
      fail(
        "A transaction reference is already submitted. Contact the store to correct it.",
        409,
      );
    if (await model.referenceExistsInProductPayments(payment.method, reference))
      fail("This transaction reference is already used.", 409);
    if ((await model.reportReference(payment.id, reference)) !== 1)
      fail("Payment changed. Refresh and try again.", 409);
    await db.commit();
    return {
      message:
        "Reference submitted. Your service payment is PENDING until the store verifies the real transaction.",
    };
  } catch (error) {
    await db.rollback();
    if (error.code === "ER_DUP_ENTRY")
      fail("This reference is already used.", 409);
    throw error;
  } finally {
    db.release();
  }
}
