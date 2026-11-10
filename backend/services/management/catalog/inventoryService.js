import { fail } from "../workspaceHelpers.js";
export async function createInventory(model, staff, data) {
  let created;
  const variant = (await model.activeVariant(data.variantId))[0];
  if (!variant) {
    fail("Select an active aircon variant.", 409);
  }
  await model.ensureInventory(data.variantId);
  const row = (await model.lockInventory(data.variantId))[0];
  if (!row) {
    fail("Could not initialize inventory for this variant.", 409);
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
  if (delta < 0 && row.onHand + delta < row.reserved) {
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
  if (
    row.onHand - row.reserved > row.reorderLevel &&
    row.onHand + delta - row.reserved <= row.reorderLevel
  ) {
    await model.notifyStaff(
      "Low stock alert",
      `Variant #${data.variantId} has reached its reorder level.`,
    );
  }
  created = movement.insertId;
  return created;
}
export async function updateInventory(model, staff, id, data) {
  let result;
  let converted = null;
  const variant = (await model.activeVariant(id))[0];
  if (!variant) {
    fail("Select an active aircon variant.", 409);
  }
  await model.ensureInventory(id);
  result = await model.updateReorder(id, data.reorderLevel);
  return { result, converted };
}
