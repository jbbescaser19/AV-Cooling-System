/** SQL for the pos management feature. */
export function posModel(db) {
  return {
    async catalog() {
      const [rows] =
        await db.execute(`SELECT v.variant_id AS variantId, p.product_name AS productName,
                    p.brand, p.model, CAST(v.horsepower AS CHAR) AS horsepower,
                    CAST(COALESCE(NULLIF(v.promo_price, 0), v.srp) AS CHAR) AS price,
                    GREATEST(COALESCE(i.on_hand_quantity, 0) -
                             COALESCE(i.reserved_quantity, 0), 0) AS available
             FROM product_variants v JOIN products p ON p.product_id = v.product_id
             LEFT JOIN inventory i ON i.variant_id = v.variant_id
             WHERE p.status = 'ACTIVE' AND v.status = 'ACTIVE' AND v.srp > 0
             ORDER BY p.brand, p.product_name, v.horsepower LIMIT 300`);
      return rows;
    },
    async previousPosSale(orderNumber, staffId) {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_number AS orderNumber,
                    recipient_name AS customer, CAST(total_amount AS CHAR) AS total,
                    payment_status AS paymentStatus
             FROM orders WHERE order_number = ? AND created_by = ?
               AND order_channel = 'POS' LIMIT 1`,
        [orderNumber, staffId],
      );
      return rows[0] || null;
    },
    async lockVariant(variantId) {
      const [rows] = await db.execute(
        `SELECT v.variant_id AS variantId, p.product_name AS productName,
                    p.model, CAST(v.horsepower AS CHAR) AS horsepower,
                    CAST(COALESCE(NULLIF(v.promo_price, 0), v.srp) AS CHAR) AS price,
                    p.status AS productStatus, v.status AS variantStatus,
                    i.inventory_id AS inventoryId,
                    COALESCE(i.on_hand_quantity, 0) AS onHand,
                    COALESCE(i.reserved_quantity, 0) AS reserved
             FROM product_variants v
             JOIN products p ON p.product_id = v.product_id
             LEFT JOIN inventory i ON i.variant_id = v.variant_id
             WHERE v.variant_id = ? LIMIT 1 FOR UPDATE`,
        [variantId],
      );
      return rows[0] || null;
    },
    async takeStock(variantId, quantity) {
      const [result] = await db.execute(
        `UPDATE inventory SET on_hand_quantity = on_hand_quantity - ?
             WHERE variant_id = ? AND on_hand_quantity - reserved_quantity >= ?`,
        [quantity, variantId, quantity],
      );
      return result.affectedRows;
    },
    async createOrder(data) {
      const scheduled = Boolean(data.scheduledStart);
      const [result] = await db.execute(
        `INSERT INTO orders
             (order_number, created_by, payment_method_id, order_channel,
              order_status, payment_status, fulfillment_method, subtotal,
              discount_amount, delivery_fee, total_amount, recipient_name,
              contact_number, delivery_address, preferred_schedule, customer_notes, completed_at)
             VALUES (?, ?, ?, 'POS', ?, 'PAID', ?, ?, ?, 0,
                     ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.orderNumber,
          data.staffId,
          data.methodId,
          scheduled ? "CONFIRMED" : "COMPLETED",
          scheduled ? "DELIVERY" : "PICKUP",
          data.subtotal,
          data.discount,
          data.total,
          data.customerName,
          data.customerPhone,
          scheduled ? data.serviceAddress : null,
          scheduled ? `${data.scheduledStart.replace("T", " ")}:00` : null,
          scheduled
            ? "Paid at POS; installation appointment requested"
            : "Paid cash at POS; take-home purchase",
          scheduled ? null : new Date(),
        ],
      );
      return result.insertId;
    },
    async addItem(orderId, item) {
      await db.execute(
        `INSERT INTO order_items
             (order_id, variant_id, product_name_snapshot, model_snapshot,
              quantity, unit_price, discount_amount, line_total, installation_included)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          orderId,
          item.variantId,
          item.productName,
          item.model,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.installationIncluded ? 1 : 0,
        ],
      );
    },
    async recordStockSale(variantId, quantity, staffId) {
      await db.execute(
        `INSERT INTO inventory_movements
             (variant_id, movement_type, quantity, created_by)
             VALUES (?, 'SALE', ?, ?)`,
        [variantId, -quantity, staffId],
      );
    },
    async recordOrderHistory(orderId, staffId, scheduled = false) {
      await db.execute(
        `INSERT INTO order_status_history
             (order_id, old_status, new_status, changed_by, notes)
             VALUES (?, NULL, ?, ?, ?)`,
        [
          orderId,
          scheduled ? "CONFIRMED" : "COMPLETED",
          staffId,
          scheduled
            ? "Cash received; appointment awaits installation"
            : "Cash collected; walk-in sale completed",
        ],
      );
    },
  };
}
