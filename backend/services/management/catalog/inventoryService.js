import { fail } from "../workspaceHelpers.js";

export async function createInventory(model, staff, data) {
  const variant = (await model.activeVariant(data.variantId))[0];

  if (!variant) {
    fail("Select an active aircon variant.", 409);
  }

  await model.ensureInventory(data.variantId);

  const row = (await model.lockInventory(data.variantId))[0];

  if (!row) {
    fail("Could not initialize inventory for this variant.", 409);
  }

  if (
    data.expectedOnHand !== undefined &&
    (Number(row.onHand) !== data.expectedOnHand ||
      Number(row.reserved) !== data.expectedReserved)
  ) {
    fail(
      "Stock changed since your review. Refresh and review the removal again.",
      409,
    );
  }

  const delta =
    data.movementType === "ADJUSTMENT"
      ? data.quantity
      : ["STOCK_IN", "RETURN"].includes(data.movementType)
        ? Math.abs(data.quantity)
        : -Math.abs(data.quantity);

  if (data.movementType !== "ADJUSTMENT" && data.quantity < 1) {
    fail("Quantity must be positive for this movement.");
  }

  if (delta < 0 && Number(row.onHand) + delta < Number(row.reserved)) {
    fail("Cannot remove stock reserved for customer orders.", 409);
  }

  const stockResult = await model.moveStock(data.variantId, delta);

  if (stockResult.affectedRows !== 1) {
    fail(
      "Stock changed or insufficient unreserved stock. Refresh Inventory and try again.",
      409,
    );
  }

  const movement = await model.recordMovement(
    data.variantId,
    data.movementType,
    delta,
    staff.id,
    data.note,
  );

  const previousOnHand = Number(row.onHand);

  const newOnHand = previousOnHand + delta;

  const reorderLevel = Number(row.reorderLevel);

  if (previousOnHand > reorderLevel && newOnHand <= reorderLevel) {
    await model.notifyStaff(
      "Low stock alert",
      `Variant #${data.variantId} has reached its reorder level.`,
    );
  }

  return movement.insertId;
}

export async function updateInventory(model, staff, id, data) {
  const variant = (await model.activeVariant(id))[0];

  if (!variant) {
    fail("Select an active aircon variant.", 409);
  }

  await model.ensureInventory(id);

  const result = await model.updateReorder(id, data.reorderLevel);

  return {
    result,
    converted: null,
  };
}
