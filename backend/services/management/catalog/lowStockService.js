import { inventoryModel } from "../../../models/management/catalog/inventoryModel.js";
import { notificationModel } from "../../../models/management/operations/notificationModel.js";

/**
 * The caller owns the transaction and has already
 * updated physical inventory.
 */
export async function notifyPhysicalStockCrossing(
  db,
  variantId,
  quantityRemoved,
) {
  const [row] = await inventoryModel(db).lockInventory(variantId);

  if (!row) return;

  const onHand = Number(row.onHand);
  const level = Number(row.reorderLevel);

  if (onHand <= level && onHand + Number(quantityRemoved) > level) {
    await notificationModel(db).notifyStaff(
      "Low stock alert",
      `Variant #${variantId}: ${onHand} units on hand (reorder at ${level}).`,
    );
  }
}
