import connectDB from "../../../utils/dbConn.js";
import { manualTransferModel } from "../../../models/customer/order/manualTransferModel.js";
import { validateTransferReference } from "../../../validators/customer/order/transferValidator.js";
const invalid = (message, status = 409) =>
  Object.assign(new Error(message), { status });
export function paymentInstructions(code) {
  const c = String(code || "").toUpperCase();
  if (c === "CASH")
    return { code: c, name: "Cash on delivery / collection", available: true };
  if (c === "GCASH") {
    const name = String(process.env.PAYMENT_GCASH_NAME || "").trim();
    const number = String(process.env.PAYMENT_GCASH_NUMBER || "").trim();
    return {
      code: c,
      name: "GCash (manual transfer)",
      available: !!(name && /^09\d{9}$/.test(number)),
      payeeName: name,
      payeeAccount: number,
    };
  }
  if (c === "BANK_TRANSFER") {
    const name = String(process.env.PAYMENT_BANK_ACCOUNT_NAME || "").trim();
    const bank = String(process.env.PAYMENT_BANK_NAME || "").trim();
    const number = String(process.env.PAYMENT_BANK_ACCOUNT_NUMBER || "").trim();
    return {
      code: c,
      name: "Bank Transfer (manual)",
      available: !!(name && bank && /^[A-Za-z0-9 -]{5,35}$/.test(number)),
      payeeName: name,
      payeeAccount: number,
      bankName: bank,
    };
  }
  return { code: c, available: false };
}
export function getPaymentOptions() {
  return {
    methods: ["CASH", "GCASH", "BANK_TRANSFER"].map(paymentInstructions),
  };
}
export async function reportManualTransfer(userId, number, raw) {
  if (!/^AV-[0-9A-F]{32}$/.test(String(number)))
    throw invalid("Invalid order reference.", 400);
  const { reference } = validateTransferReference(raw);
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const model = manualTransferModel(db);
    const order = await model.lockOrderAndPayment(userId, number);
    if (!order) throw invalid("Order was not found.", 404);
    if (!["GCASH", "BANK_TRANSFER"].includes(order.method))
      throw invalid("This order uses a different payment method.");
    if (
      !["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
        order.orderStatus,
      )
    ) {
      throw invalid(
        "Wait until the store confirms your order before reporting a transfer.",
      );
    }
    if (
      order.paymentStatus !== "PENDING" ||
      order.orderPaymentStatus !== "PENDING"
    )
      throw invalid("This payment is no longer pending.");
    if (await model.existing(order.paymentId))
      throw invalid(
        "A reference is already submitted. Contact the store to correct it.",
      );
    await model.create(order.paymentId, userId, order.method, reference);
    await db.commit();
    return {
      message:
        "Reference received. Your payment is pending staff verification.",
    };
  } catch (error) {
    await db.rollback();
    if (error.code === "ER_DUP_ENTRY")
      throw invalid("This reference was already submitted. Contact the store.");
    throw error;
  } finally {
    db.release();
  }
}
