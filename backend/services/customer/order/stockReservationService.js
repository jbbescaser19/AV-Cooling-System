import { stockReservationModel } from "../../../models/customer/order/stockReservationModel.js";

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  throw error;
}

/** Call ONLY inside the caller's database transaction. */
export async function reserveForOrder(db, orderId, lines) {
  const model = stockReservationModel(db);
  const reservationId = await model.create(orderId);
  for (const item of [...lines].sort((a, b) => a.variantId - b.variantId)) {
    if ((await model.reserve(item.variantId, item.quantity)) !== 1) {
      conflict(
        `${item.productName} is out of stock or has insufficient units. Refresh your cart.`,
      );
    }
    await model.addItem(reservationId, item.variantId, item.quantity);
  }
}

/** Releases a reservation after an eligible unpaid cancellation. */
export async function releaseOrderReservation(db, orderId) {
  const model = stockReservationModel(db);
  const reservationId = await model.lockActive(orderId);
  if (!reservationId) return false; // Old orders may not have reservations.
  for (const item of await model.items(reservationId)) {
    if (item.quantity <= 0) continue;
    if ((await model.release(item.variantId, item.quantity)) !== 1) {
      conflict("Could not release reserved stock. Refresh and retry.");
    }
  }
  if ((await model.finish(reservationId, "RELEASED")) !== 1) {
    conflict("Stock reservation was changed. Refresh and retry.");
  }
  return true;
}

/** On successful delivery, turn reserved units into a physical stock-out. */
export async function fulfillOrderReservation(db, orderId, staffId) {
  const model = stockReservationModel(db);
  const reservationId = await model.lockActive(orderId);
  if (!reservationId) return false;
  for (const item of await model.items(reservationId)) {
    if (item.quantity <= 0) continue;
    if ((await model.deliver(item.variantId, item.quantity)) !== 1) {
      conflict("Reserved stock could not be delivered. Refresh and retry.");
    }
    await model.recordSale(item.variantId, item.quantity, staffId, orderId);
  }
  if ((await model.finish(reservationId, "CONVERTED")) !== 1) {
    conflict("Stock reservation was changed. Refresh and retry.");
  }
  return true;
}
