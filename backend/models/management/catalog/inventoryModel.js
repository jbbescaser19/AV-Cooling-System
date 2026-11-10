/** Dedicated inventory database queries. */
export function inventoryModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listInventory(staffId) {
      return select(
        `SELECT v.variant_id AS id,CONCAT(p.brand,' ',p.model,' · ',v.horsepower,' HP') AS name,COALESCE(i.on_hand_quantity,0) AS onHand,COALESCE(i.reserved_quantity,0) AS reserved,COALESCE(i.on_hand_quantity-i.reserved_quantity,0) AS available,COALESCE(i.reorder_level,0) AS reorderLevel FROM product_variants v JOIN products p ON p.product_id=v.product_id LEFT JOIN inventory i ON i.variant_id=v.variant_id ORDER BY p.brand,p.model,v.horsepower LIMIT 300`,
      );
    },
    ensureInventory(variantId) {
      return execute(
        `INSERT INTO inventory(variant_id,on_hand_quantity,reserved_quantity,reorder_level) VALUES (?,0,0,2) ON DUPLICATE KEY UPDATE variant_id=VALUES(variant_id)`,
        [variantId],
      );
    },
    updateReorder(recordId, level) {
      return execute(
        `UPDATE inventory SET reorder_level=? WHERE variant_id=?`,
        [level, recordId],
      );
    },
    lockInventory(variantId) {
      return select(
        `SELECT inventory_id,on_hand_quantity AS onHand,reserved_quantity AS reserved,reorder_level AS reorderLevel FROM inventory WHERE variant_id=? FOR UPDATE`,
        [variantId],
      );
    },
    moveStock(variantId, delta) {
      return execute(
        `UPDATE inventory SET on_hand_quantity=on_hand_quantity+? WHERE variant_id=? AND on_hand_quantity+?>=reserved_quantity`,
        [delta, variantId, delta],
      );
    },
    async lockReservedUnits(orderId) {
      return select(
        `SELECT r.reservation_id AS reservationId,ri.variant_id AS variantId,ri.reserved_quantity AS quantity FROM stock_reservations r JOIN stock_reservation_items ri ON ri.reservation_id=r.reservation_id WHERE r.order_id=? AND r.status='ACTIVE' FOR UPDATE`,
        [orderId],
      );
    },
    async deliverReservedVariant(variantId, qty) {
      const result = await execute(
        `UPDATE inventory SET on_hand_quantity=on_hand_quantity-?,reserved_quantity=reserved_quantity-? WHERE variant_id=? AND reserved_quantity>=? AND on_hand_quantity>=?`,
        [qty, qty, variantId, qty, qty],
      );
      return result.affectedRows;
    },
    async finishReservation(id) {
      const r = await execute(
        `UPDATE stock_reservations SET status='CONVERTED',converted_at=CURRENT_TIMESTAMP WHERE reservation_id=? AND status='ACTIVE'`,
        [id],
      );
      return r.affectedRows;
    },
    reserveStock(id, qty) {
      return execute(
        `UPDATE inventory SET reserved_quantity=reserved_quantity+? WHERE variant_id=? AND on_hand_quantity-reserved_quantity>=?`,
        [qty, id, qty],
      );
    },
    reserveOrder(orderId, variantId, qty) {
      return (async () => {
        const result = await execute(
          `INSERT INTO stock_reservations(order_id,status) VALUES (?,'ACTIVE')`,
          [orderId],
        );
        await execute(
          `INSERT INTO stock_reservation_items(reservation_id,variant_id,reserved_quantity) VALUES (?,?,?)`,
          [result.insertId, variantId, qty],
        );
      })();
    },
  };
}
