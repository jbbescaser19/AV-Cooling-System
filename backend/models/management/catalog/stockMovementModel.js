/** Dedicated stockMovement database queries. */
export function stockMovementModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listStockMovements(staffId) {
      return select(
        `SELECT m.movement_id AS id,CONCAT(p.brand,' ',p.model,' · ',v.horsepower,' HP') AS product,m.movement_type AS movementType,m.quantity,m.note,u.name AS staff,m.created_at AS createdAt FROM inventory_movements m JOIN product_variants v ON v.variant_id=m.variant_id JOIN products p ON p.product_id=v.product_id JOIN users u ON u.user_id=m.created_by ORDER BY m.movement_id DESC LIMIT 200`,
      );
    },
    recordMovement(variantId, type, delta, staffId, note) {
      return execute(
        `INSERT INTO inventory_movements(variant_id,movement_type,quantity,created_by,note) VALUES (?,?,?,?,?)`,
        [variantId, type, delta, staffId, note],
      );
    },
  };
}
