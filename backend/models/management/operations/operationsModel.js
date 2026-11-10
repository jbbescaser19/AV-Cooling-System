/** Order/service workflow model composer: SQL is in feature models. */
import { orderModel } from "../sales/orderFulfillmentModel.js";
import { serviceRequestModel } from "../services/serviceFulfillmentModel.js";
import { fulfillmentEventModel } from "./fulfillmentEventModel.js";
import { paymentModel } from "../sales/paymentFulfillmentModel.js";
export function operationsModel(db) {
  return {
    ...orderModel(db),
    ...serviceRequestModel(db),
    ...fulfillmentEventModel(db),
    ...paymentModel(db),
  };
}
