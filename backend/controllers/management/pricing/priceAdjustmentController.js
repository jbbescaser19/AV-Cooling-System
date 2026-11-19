import { respond } from "../operations/operationsController.js";

import {
  getPriceAdjustment,
  updatePriceAdjustment,
} from "../../../services/management/pricing/priceAdjustmentService.js";

export const getOrderPricing = respond((req) =>
  getPriceAdjustment("ORDER", req.params.id, req.staff),
);

export const updateOrderPricing = respond((req) =>
  updatePriceAdjustment("ORDER", req.params.id, req.staff, req.body),
);

export const getServicePricing = respond((req) =>
  getPriceAdjustment("SERVICE", req.params.id, req.staff),
);

export const updateServicePricing = respond((req) =>
  updatePriceAdjustment("SERVICE", req.params.id, req.staff, req.body),
);
