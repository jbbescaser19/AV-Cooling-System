/** All POS, order-listing, and payment-listing SQL lives here. */
export function salesModel(db) {
  return {
    async catalog() {
      const [rows] = await db.execute(
        `SELECT v.variant_id AS variantId, p.product_name AS productName,
                p.brand, p.model, CAST(v.horsepower AS CHAR) AS horsepower,
                CAST(COALESCE(NULLIF(v.promo_price, 0), v.srp) AS CHAR) AS price,
                GREATEST(COALESCE(i.on_hand_quantity, 0) -
                         COALESCE(i.reserved_quantity, 0), 0) AS available
         FROM product_variants v JOIN products p ON p.product_id = v.product_id
         LEFT JOIN inventory i ON i.variant_id = v.variant_id
         WHERE p.status = 'ACTIVE' AND v.status = 'ACTIVE' AND v.srp > 0
         ORDER BY p.brand, p.product_name, v.horsepower LIMIT 300`,
      );
      return rows;
    },
    async cashMethod() {
      const [rows] = await db.execute(
        `SELECT payment_method_id AS id FROM payment_methods
         WHERE code = 'CASH' AND is_enabled = 1 LIMIT 1`,
      );
      return rows[0]?.id || null;
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
      const [result] = await db.execute(
        `INSERT INTO orders
         (order_number, created_by, payment_method_id, order_channel,
          order_status, payment_status, fulfillment_method, subtotal,
          discount_amount, delivery_fee, total_amount, recipient_name,
          contact_number, customer_notes, completed_at)
         VALUES (?, ?, ?, 'POS', 'COMPLETED', 'PAID', 'PICKUP', ?, ?, 0,
                 ?, ?, ?, 'Paid cash at POS; take-home purchase', CURRENT_TIMESTAMP)`,
        [
          data.orderNumber,
          data.staffId,
          data.methodId,
          data.subtotal,
          data.discount,
          data.total,
          data.customerName,
          data.customerPhone,
        ],
      );
      return result.insertId;
    },
    async addItem(orderId, item) {
      await db.execute(
        `INSERT INTO order_items
         (order_id, variant_id, product_name_snapshot, model_snapshot,
          quantity, unit_price, discount_amount, line_total, installation_included)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)`,
        [
          orderId,
          item.variantId,
          item.productName,
          item.model,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
    },
    async recordPayment(orderId, methodId, total, staffId, notes) {
      await db.execute(
        `INSERT INTO payments
         (order_id, payment_method_id, amount, payment_status,
          paid_at, recorded_by, notes)
         VALUES (?, ?, ?, 'PAID', CURRENT_TIMESTAMP, ?, ?)`,
        [orderId, methodId, total, staffId, notes],
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
    async recordOrderHistory(orderId, staffId) {
      await db.execute(
        `INSERT INTO order_status_history
         (order_id, old_status, new_status, changed_by, notes)
         VALUES (?, NULL, 'COMPLETED', ?, 'Cash collected; walk-in sale completed')`,
        [orderId, staffId],
      );
    },
    async orders() {
      const [rows] = await db.execute(
        `SELECT o.order_id AS id, o.order_number AS reference,
                o.order_channel AS channel, o.recipient_name AS customer,
                o.order_status AS status, o.payment_status AS paymentStatus,
                CAST(o.total_amount AS CHAR) AS total,
                o.ordered_at AS createdAt,
                DATE_FORMAT(o.preferred_schedule, '%Y-%m-%dT%H:%i') AS schedule,
                EXISTS (SELECT 1 FROM fulfillment_events e
                  WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                    AND e.event_code='ORDER_DELIVERED') AS delivered,
                EXISTS (SELECT 1 FROM fulfillment_events e
                  WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                    AND e.event_code='INSTALLATION_STARTED') AS installationStarted
         FROM orders o ORDER BY o.order_id DESC LIMIT 150`,
      );
      return rows;
    },
    async orderDetails(id) {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_number AS reference,
                order_channel AS channel, recipient_name AS customer,
                contact_number AS phone, fulfillment_method AS fulfillment,
                delivery_address AS address, order_status AS status,
                payment_status AS paymentStatus,
                CAST(subtotal AS CHAR) AS subtotal,
                CAST(discount_amount AS CHAR) AS discount,
                CAST(total_amount AS CHAR) AS total,
                ordered_at AS createdAt
         FROM orders WHERE order_id = ? LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },
    async orderItems(id) {
      const [rows] = await db.execute(
        `SELECT product_name_snapshot AS name, model_snapshot AS model,
                quantity, CAST(unit_price AS CHAR) AS unitPrice,
                CAST(line_total AS CHAR) AS lineTotal
         FROM order_items WHERE order_id = ? ORDER BY order_item_id`,
        [id],
      );
      return rows;
    },
    async payments() {
      const [rows] = await db.execute(
        `SELECT pay.payment_id AS id, o.order_number AS orderNumber,
                o.order_channel AS channel, o.order_status AS orderStatus,
                o.recipient_name AS customer, pay.payment_status AS status,
                pm.code AS method, CAST(pay.amount AS CHAR) AS amount,
                pay.paid_at AS paidAt, pay.created_at AS createdAt,
                pay.notes, u.name AS recordedBy
         FROM payments pay
         JOIN orders o ON o.order_id = pay.order_id
         JOIN payment_methods pm ON pm.payment_method_id = pay.payment_method_id
         LEFT JOIN users u ON u.user_id = pay.recorded_by
         ORDER BY pay.payment_id DESC LIMIT 200`,
      );
      return rows;
    },
    async facebookPaymentForUpdate(paymentId) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id,p.payment_status AS paymentStatus,
                o.order_id AS orderId,o.order_status AS orderStatus,
                o.payment_status AS orderPaymentStatus,
                o.order_channel AS channel,pm.code AS method
         FROM payments p JOIN orders o ON o.order_id=p.order_id
         JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
         WHERE p.payment_id=? LIMIT 1 FOR UPDATE`,
        [paymentId],
      );
      return rows[0] || null;
    },
    async confirmFacebookCash(paymentId, staffId, note) {
      const [r] = await db.execute(
        `UPDATE payments SET payment_status='PAID',paid_at=CURRENT_TIMESTAMP,recorded_by=?,notes=? WHERE payment_id=? AND payment_status='PENDING'`,
        [staffId, note, paymentId],
      );
      return r.affectedRows;
    },
    async confirmFacebookOrder(orderId) {
      const [r] = await db.execute(
        `UPDATE orders SET payment_status='PAID' WHERE order_id=? AND order_channel='FACEBOOK' AND payment_status='PENDING'`,
        [orderId],
      );
      return r.affectedRows;
    },
    async auditCashCollection(staffId, paymentId) {
      await db.execute(
        `INSERT INTO audit_logs(user_id,action,module,affected_record_type,affected_record_id) VALUES (?,'CONFIRM_CASH','payments','PAYMENT',?)`,
        [staffId, paymentId],
      );
    },
    async paymentForConfirmation(paymentId) {
      const [rows] = await db.execute(
        `SELECT pay.payment_id AS id, pay.payment_status AS status,
                pm.code AS method, o.order_number AS orderNumber,
                o.order_channel AS channel, o.order_status AS orderStatus
         FROM payments pay
         JOIN orders o ON o.order_id = pay.order_id
         JOIN payment_methods pm ON pm.payment_method_id = pay.payment_method_id
         WHERE pay.payment_id = ? LIMIT 1`,
        [paymentId],
      );
      return rows[0] || null;
    },
  };
}
