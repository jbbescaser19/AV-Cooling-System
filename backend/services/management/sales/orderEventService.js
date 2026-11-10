import { EVENT_LABELS } from "../../../constants/management/fulfillmentEvents.js";
import {
  releaseOrderReservation,
  fulfillOrderReservation,
} from "../../customer/order/stockReservationService.js";
import {
  fail,
  requireStatus,
  requirePreviousEvent,
  forbidRepeatedEvent,
} from "../operations/eventHelpers.js";
export async function transitionOrder(
  model,
  connection,
  order,
  data,
  staffId,
  scheduleSQL,
) {
  const code = data.eventCode;
  const status = order.status;
  const id = order.id;
  let next = status;
  if (code === "ORDER_ACCEPTED") {
    requireStatus(status, code, "PENDING");
    next = "CONFIRMED";
  } else if (code === "INSTALLATION_SCHEDULED") {
    requireStatus(status, code, "CONFIRMED");
    await forbidRepeatedEvent(model, "ORDER", id, code);
    next = "SCHEDULED";
  } else if (code === "SCHEDULE_CHANGED") {
    requireStatus(status, code, "SCHEDULED");
    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_SCHEDULED");
    if (order.schedule === data.schedule) {
      fail("Choose a different appointment time.");
    }
  } else if (code === "ORDER_OUT_FOR_DELIVERY") {
    requireStatus(status, code, "SCHEDULED");
    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_SCHEDULED");
    next = "IN_PROGRESS";
  } else if (code === "ORDER_DELIVERED") {
    requireStatus(status, code, "IN_PROGRESS");
    await requirePreviousEvent(model, "ORDER", id, "ORDER_OUT_FOR_DELIVERY");
    await forbidRepeatedEvent(model, "ORDER", id, code);
    // Delivery is the physical stock-out. Order creation only reserves units.
    await fulfillOrderReservation(connection, id, staffId);
  } else if (code === "INSTALLATION_STARTED") {
    requireStatus(status, code, "IN_PROGRESS");
    await requirePreviousEvent(model, "ORDER", id, "ORDER_DELIVERED");
    await forbidRepeatedEvent(model, "ORDER", id, code);
  } else if (code === "INSTALLATION_COMPLETED") {
    requireStatus(status, code, "IN_PROGRESS");
    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_STARTED");
    next = "COMPLETED";
  } else if (code === "EXTRA_CHARGES_PROPOSED") {
    requireStatus(status, code, "CONFIRMED", "SCHEDULED", "IN_PROGRESS");
  } else if (code === "PAYMENT_CONFIRMED") {
    requireStatus(
      status,
      code,
      "CONFIRMED",
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
    );
    if (order.paymentStatus !== "PENDING" || data.paymentVerified !== true) {
      fail(
        "Cash must actually be collected and verified before recording payment.",
      );
    }
    const payments = await model.lockPayments(id);
    if (payments.length !== 1 || payments[0].status !== "PENDING") {
      fail("Payment records are not eligible for confirmation.");
    }
    const paymentUpdated = await model.markPaymentPaid(
      payments[0].id,
      staffId,
      data.note || "Cash collected and verified by staff.",
    );
    if (paymentUpdated !== 1) {
      fail("Payment changed during verification. Please refresh.");
    }
    const orderUpdated = await model.markOrderPaymentPaid(id);
    if (orderUpdated !== 1) {
      fail("Order payment changed during verification. Please refresh.");
    }
  } else if (code === "ORDER_DECLINED" || code === "ORDER_CANCELLED_BY_STAFF") {
    const allowed =
      code === "ORDER_DECLINED"
        ? ["PENDING"]
        : ["PENDING", "CONFIRMED", "SCHEDULED"];
    requireStatus(status, code, ...allowed);
    if (order.paymentStatus !== "PENDING") {
      fail("A paid order needs a separate refund workflow.");
    }
    const payments = await model.lockPayments(id);
    if (
      !payments.length ||
      payments.some((payment) => payment.status !== "PENDING")
    ) {
      fail("Payment is not eligible for cancellation.");
    }
    if (await model.hasEvent("ORDER", id, "ORDER_OUT_FOR_DELIVERY")) {
      fail("Order already left for delivery.");
    }
    await model.cancelPendingPayments(id);
    await model.cancelOrderPayment(id);
    await releaseOrderReservation(connection, id);
    next = "CANCELLED";
  } else {
    fail("Invalid order event.", 400);
  }
  if (next !== status || scheduleSQL) {
    await model.setOrderStatus(id, next, scheduleSQL);
  }
  await model.addOrderHistory(
    id,
    status,
    next,
    staffId,
    `${EVENT_LABELS[code][0]}${data.note ? `: ${data.note}` : ""}`,
  );
}
