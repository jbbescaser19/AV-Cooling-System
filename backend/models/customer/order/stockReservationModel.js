/** Shared inventory reservation SQL; used by checkout and fulfillment. */
export function stockReservationModel(db) {
  return {
    async create(orderId) {
      const [result] = await db.execute(
        `INSERT INTO stock_reservations (order_id, status) VALUES (?, 'ACTIVE')`,
        [orderId],
      );
      return result.insertId;
    },

    async reserve(variantId, quantity) {
      const [result] = await db.execute(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity + ?
         WHERE variant_id = ?
           AND on_hand_quantity - reserved_quantity >= ?`,
        [quantity, variantId, quantity],
      );
      return result.affectedRows;
    },

    async addItem(reservationId, variantId, quantity) {
      await db.execute(
        `INSERT INTO stock_reservation_items
           (reservation_id, variant_id, reserved_quantity)
         VALUES (?, ?, ?)`,
        [reservationId, variantId, quantity],
      );
    },

    async lockActive(orderId) {
      const [rows] = await db.execute(
        `SELECT reservation_id AS id FROM stock_reservations
         WHERE order_id = ? AND status = 'ACTIVE'
         LIMIT 1 FOR UPDATE`,
        [orderId],
      );
      return rows[0]?.id || null;
    },

    async items(reservationId) {
      const [rows] = await db.execute(
        `SELECT variant_id AS variantId,
                reserved_quantity - released_quantity AS quantity
         FROM stock_reservation_items
         WHERE reservation_id = ?
         ORDER BY variant_id FOR UPDATE`,
        [reservationId],
      );
      return rows;
    },

    async release(variantId, quantity) {
      const [result] = await db.execute(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity - ?
         WHERE variant_id = ? AND reserved_quantity >= ?`,
        [quantity, variantId, quantity],
      );
      return result.affectedRows;
    },

    async deliver(variantId, quantity) {
      const [result] = await db.execute(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity - ?,
             on_hand_quantity = on_hand_quantity - ?
         WHERE variant_id = ?
           AND reserved_quantity >= ?
           AND on_hand_quantity >= ?`,
        [quantity, quantity, variantId, quantity, quantity],
      );
      return result.affectedRows;
    },

    async recordSale(variantId, quantity, staffId, orderId) {
      await db.execute(
        `INSERT INTO inventory_movements
           (variant_id, movement_type, quantity, created_by, note)
         VALUES (?, 'SALE', ?, ?, ?)`,
        [variantId, -quantity, staffId, `Online order #${orderId} delivered`],
      );
    },

    async finish(reservationId, status) {
      const column = status === "RELEASED" ? "released_at" : "converted_at";
      const [result] = await db.execute(
        `UPDATE stock_reservations
         SET status = ?, ${column} = CURRENT_TIMESTAMP
         WHERE reservation_id = ? AND status = 'ACTIVE'`,
        [status, reservationId],
      );
      return result.affectedRows;
    },
  };
}
