import connectDB from "../../../utils/dbConn.js";
import { paymentMethodModel } from "../../../models/customer/order/paymentMethodModel.js";
import { paymongoConfigured } from "../../payments/paymongoService.js";

const allowed = [
  { code: "CASH", name: "Cash" },
  { code: "GCASH", name: "GCash · secure PayMongo Checkout" },
  { code: "BANK_TRANSFER", name: "QR Ph · bank app via PayMongo" },
];

/** These are payment preferences, not online gateway transactions. */
export async function getPaymentOptions() {
  const enabled = new Set(await paymentMethodModel(connectDB).enabledMethods());
  return {
    methods: allowed.map((method) => ({
      ...method,
      available:
        enabled.has(method.code) &&
        (method.code === "CASH" || paymongoConfigured()),
    })),
  };
}
