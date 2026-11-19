import {
  DELIVERY_AREAS,
  getDeliveryFee,
} from "../../shared/deliveryPricingService.js";

function invalid(message) {
  throw Object.assign(new Error(message), {
    status: 422,
  });
}

export function resolveFacebookDelivery(input, address, previous = {}) {
  const completeAddress = String(address || "").trim();

  if (completeAddress.length < 5 || completeAddress.length > 2000) {
    invalid("Enter the complete delivery address.");
  }

  const area = input.deliveryArea ?? previous.delivery_area_code;

  if (!area) {
    invalid("Select a delivery area before saving the agreement.");
  }

  if (area === "OTHER") {
    const priorCustom = previous.delivery_area_code === "OTHER";

    const fee =
      input.customDeliveryFee ??
      (priorCustom ? Number(previous.quoted_delivery_fee) : 0);

    const reason = String(
      input.deliveryFeeReason ??
        (priorCustom ? previous.delivery_fee_reason : "") ??
        "",
    ).trim();

    if (completeAddress.length < 10) {
      invalid("Enter the complete remote delivery address.");
    }

    if (
      !Number.isFinite(fee) ||
      fee <= 0 ||
      fee > 99999.99 ||
      Math.abs(fee * 100 - Math.round(fee * 100)) > 0.000001
    ) {
      invalid("Enter a valid agreed delivery fee (up to ₱99,999.99).");
    }

    if (reason.length < 5 || reason.length > 255) {
      invalid("Enter a reason for the custom delivery fee.");
    }

    return {
      address: completeAddress,
      area,
      fee: Math.round(fee * 100) / 100,
      reason,
    };
  }

  if (!Object.hasOwn(DELIVERY_AREAS, area)) {
    invalid("Choose a valid delivery area.");
  }

  return {
    address: completeAddress,
    area,
    fee: getDeliveryFee(area, completeAddress),
    reason: null,
  };
}
