/** SQL for the pos management feature. */
export function posModel(db) {
  return {
    async searchReturningCustomers(pattern) {
      // Show only matching contact details needed for POS.
      // No passwords, emails, or full management customer records are exposed.
      const [rows] = await db.execute(
        `SELECT matches.name, matches.phone, matches.address, matches.source
         FROM (
           SELECT matchesBySource.*,
             ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(matchesBySource.name)), TRIM(matchesBySource.phone)
               ORDER BY matchesBySource.recordedAt DESC
             ) AS rowNumber
           FROM (
             SELECT u.name AS name, c.phone AS phone,
               COALESCE((SELECT a.full_address FROM customer_addresses a
                  WHERE a.customer_id = c.customer_id
                  ORDER BY a.is_default DESC, a.created_at DESC, a.address_id DESC
                  LIMIT 1), '') AS address,
               'Registered customer' AS source, c.created_at AS recordedAt
             FROM customers c JOIN users u ON u.user_id=c.user_id
             WHERE c.status='ACTIVE' AND u.status='ACTIVE'
               AND u.account_type='CUSTOMER' AND c.phone IS NOT NULL
             UNION ALL
             SELECT o.recipient_name AS name, o.contact_number AS phone,
               COALESCE(o.delivery_address,'') AS address,
               'Previous order' AS source, o.ordered_at AS recordedAt
             FROM orders o
             UNION ALL
             SELECT COALESCE(sr.walk_in_customer_name, u.name) AS name,
               sr.contact_number AS phone,
               sr.service_address AS address,
               'Previous service' AS source, sr.created_at AS recordedAt
             FROM service_requests sr
             LEFT JOIN customers c ON c.customer_id=sr.customer_id
             LEFT JOIN users u ON u.user_id=c.user_id
           ) matchesBySource
           WHERE matchesBySource.name IS NOT NULL
             AND matchesBySource.phone IS NOT NULL
             AND matchesBySource.phone <> ''
             AND (LOWER(matchesBySource.name) LIKE LOWER(?) ESCAPE '!'
               OR matchesBySource.phone LIKE ? ESCAPE '!')
         ) matches
         WHERE matches.rowNumber=1
         ORDER BY matches.recordedAt DESC LIMIT 12`,
        [pattern, pattern],
      );
      return rows;
    },
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
                    recipient_name AS customer, contact_number AS contact,
                    CAST(total_amount AS CHAR) AS total,
                    CAST(additional_fee_amount AS CHAR) AS additionalFee,
                    additional_fee_reason AS additionalFeeReason,
                    payment_status AS paymentStatus,
                    (SELECT payment_id FROM payments WHERE order_id=orders.order_id LIMIT 1) AS paymentId
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
              discount_amount, delivery_fee, additional_fee_amount, additional_fee_reason,
              total_amount, recipient_name,
              contact_number, delivery_address, preferred_schedule, customer_notes, completed_at)
             VALUES (?, ?, ?, 'POS', ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.orderNumber,
          data.staffId,
          data.methodId,
          scheduled || !data.paid ? "CONFIRMED" : "COMPLETED",
          data.paid ? "PAID" : "PENDING",
          scheduled ? "DELIVERY" : "PICKUP",
          data.subtotal,
          data.discount,
          data.deliveryFee,
          data.additionalFee,
          data.additionalFeeReason || null,
          data.total,
          data.customerName,
          data.customerPhone,
          scheduled ? data.serviceAddress : null,
          scheduled ? `${data.scheduledStart.replace("T", " ")}:00` : null,
          data.paid
            ? scheduled
              ? "Cash paid; scheduled POS fulfillment"
              : "Cash paid; take-home purchase"
            : "PayMongo payment pending; do not release stock before provider confirmation",
          data.paid && !scheduled ? new Date() : null,
        ],
      );
      return result.insertId;
    },
    async posPaymentId(orderId) {
      const [rows] = await db.execute(
        `SELECT payment_id AS id FROM payments WHERE order_id=? LIMIT 1`,
        [orderId],
      );
      return rows[0]?.id || null;
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
    async recordOrderHistory(
      orderId,
      staffId,
      scheduled = false,
      installationIncluded = false,
      paid = true,
    ) {
      await db.execute(
        `INSERT INTO order_status_history
             (order_id, old_status, new_status, changed_by, notes)
             VALUES (?, NULL, ?, ?, ?)`,
        [
          orderId,
          scheduled || !paid ? "CONFIRMED" : "COMPLETED",
          staffId,
          !paid
            ? "PayMongo payment awaiting verification"
            : scheduled
              ? installationIncluded
                ? "Cash received; appointment awaits delivery and installation"
                : "Cash received; appointment awaits delivery"
              : "Cash collected; walk-in sale completed",
        ],
      );
    },
  };
}
