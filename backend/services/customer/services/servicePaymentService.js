import connectDB from "../../../utils/dbConn.js";
import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";
import { paymentMethodModel } from "../../../models/customer/order/paymentMethodModel.js";
import { paymongoConfigured } from "../../payments/paymongoService.js";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

/** Only a preference is recorded. Customers never submit transfers here. */
export async function assertServicePaymentAvailable(code) {
  if (!["CASH", "GCASH", "BANK_TRANSFER"].includes(code))
    fail("Choose a valid payment method.");
  if (code !== "CASH" && !paymongoConfigured())
    fail("PayMongo is not configured for online payment.", 503);
  if (!(await paymentMethodModel(connectDB).isEnabled(code)))
    fail(
      "This payment method is currently unavailable. Choose another method.",
      409,
    );
  return code;
}

export async function listMyServicePayments(userId) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1)
    fail("Invalid session.", 401);
  return {
    payments: await servicePaymentModel(connectDB).customerPayments(userId),
  };
}
