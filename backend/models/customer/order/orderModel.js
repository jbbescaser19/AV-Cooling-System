export function orderModel(db) {
  return {
    async customer(userId, lock = false) {
      const [rows] = await db.execute(
        `SELECT c.customer_id AS customerId, c.phone, u.name
         FROM customers c JOIN users u ON u.user_id = c.user_id
         WHERE c.user_id = ? AND c.status = 'ACTIVE'
           AND u.status = 'ACTIVE' AND u.account_type = 'CUSTOMER'
         LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [userId],
      );
      return rows[0] || null;
    },

    async paymentMethod() {
      const [rows] = await db.execute(
        `SELECT payment_method_id AS id FROM payment_methods
         WHERE code = 'CASH' AND is_enabled = 1 LIMIT 1`,
      );
      return rows[0]?.id ?? null;
    },

    async existingByNumber(orderNumber) {
      const [rows] = await db.execute(
        `SELECT order_id AS orderId, customer_id AS customerId
         FROM orders WHERE order_number = ? LIMIT 1`,
        [orderNumber],
      );
      return rows[0] || null;
    },

    async activeCart(customerId) {
      const [rows] = await db.execute(
        `SELECT cart_id AS cartId FROM carts
         WHERE customer_id = ? AND status = 'ACTIVE'
         ORDER BY cart_id DESC LIMIT 1`,
        [customerId],
      );
      return rows[0]?.cartId ?? null;
    },

    async cartLine(cartId, variantId) {
      const [rows] = await db.execute(
        `SELECT ci.quantity, pv.variant_id AS variantId,
                p.product_name AS productName, p.model AS modelName,
                p.status AS productStatus, pv.status AS variantStatus,
                pv.srp, pv.promo_price AS promoPrice,
                CAST(pv.horsepower AS CHAR) AS horsepower
         FROM cart_items ci
         JOIN product_variants pv ON pv.variant_id = ci.variant_id
         JOIN products p ON p.product_id = pv.product_id
         WHERE ci.cart_id = ? AND ci.variant_id = ?
         LIMIT 1 FOR UPDATE`,
        [cartId, variantId],
      );
      return rows[0] || null;
    },

    async directVariant(productId, horsepower) {
      const [rows] = await db.execute(
        `SELECT pv.variant_id AS variantId, p.product_name AS productName,
                p.model AS modelName, p.status AS productStatus,
                pv.status AS variantStatus, pv.srp,
                pv.promo_price AS promoPrice,
                CAST(pv.horsepower AS CHAR) AS horsepower
         FROM products p JOIN product_variants pv ON pv.product_id = p.product_id
         WHERE COALESCE(NULLIF(p.catalog_key, ''), p.model) = ?
           AND pv.horsepower = ? LIMIT 1 FOR UPDATE`,
        [productId, horsepower],
      );
      return rows[0] || null;
    },

    async insertOrder(data) {
      const [result] = await db.execute(
        `INSERT INTO orders
         (order_number, customer_id, payment_method_id, order_channel,
          order_status, payment_status, fulfillment_method, subtotal,
          discount_amount, delivery_fee, total_amount, recipient_name,
          contact_number, delivery_address, customer_notes, preferred_schedule)
         VALUES (?, ?, ?, 'ONLINE', 'PENDING', 'PENDING', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
        [
          data.orderNumber,
          data.customerId,
          data.paymentMethodId,
          data.fulfillment,
          data.total,
          data.total,
          data.recipientName,
          data.contactNumber,
          data.deliveryAddress,
          data.customerNotes,
          data.preferredSchedule,
        ],
      );
      return result.insertId;
    },

    async insertItem(orderId, item) {
      await db.execute(
        `INSERT INTO order_items
         (order_id, variant_id, product_name_snapshot, model_snapshot,
          quantity, unit_price, discount_amount, line_total, installation_included)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1)`,
        [
          orderId,
          item.variantId,
          item.productName,
          item.modelName,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
    },

    async insertPayment(orderId, paymentMethodId, total) {
      await db.execute(
        `INSERT INTO payments
         (order_id, payment_method_id, amount, payment_status, notes)
         VALUES (?, ?, ?, 'PENDING', 'Cash payment for delivery and installation; collection as arranged with store.')`,
        [orderId, paymentMethodId, total],
      );
    },

    async insertStatus(orderId, userId) {
      await db.execute(
        `INSERT INTO order_status_history
         (order_id, old_status, new_status, changed_by, notes)
         VALUES (?, NULL, 'PENDING', ?, 'Customer submitted online checkout')`,
        [orderId, userId],
      );
    },

    async removeCheckedLine(cartId, variantId, qty) {
      const [result] = await db.execute(
        `DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ? AND quantity = ?`,
        [cartId, variantId, qty],
      );
      return result.affectedRows;
    },

    // Customer self-service is limited to unpaid ONLINE cash orders that
    // have not entered staff fulfillment. Lock the exact owner's order.
    async lockCustomerOrder(customerId, orderNumber) {
      const [rows] = await db.execute(
        `SELECT o.order_id AS orderId, o.order_status AS status,
                o.payment_status AS paymentStatus, o.order_channel AS channel,
                pm.code AS paymentCode, o.delivery_fee AS deliveryFee,
                o.recipient_name AS recipientName,
                o.contact_number AS contactNumber,
                o.fulfillment_method AS fulfillment,
                o.delivery_address AS deliveryAddress,
                o.customer_notes AS customerNotes,
                DATE_FORMAT(o.preferred_schedule, '%Y-%m-%dT%H:%i') AS preferredSchedule
         FROM orders o
         INNER JOIN payment_methods pm ON pm.payment_method_id = o.payment_method_id
         WHERE o.customer_id = ? AND o.order_number = ?
         LIMIT 1 FOR UPDATE`,
        [customerId, orderNumber],
      );
      return rows[0] || null;
    },

    async hasWorkOrders(orderId) {
      const [rows] = await db.execute(
        `SELECT work_order_id FROM work_orders
         WHERE order_id = ? AND status <> 'CANCELLED'
         LIMIT 1 FOR UPDATE`,
        [orderId],
      );
      return rows.length > 0;
    },

    async lockPaymentStates(orderId) {
      const [rows] = await db.execute(
        `SELECT payment_status AS status FROM payments
         WHERE order_id = ? FOR UPDATE`,
        [orderId],
      );
      return rows.map((row) => row.status);
    },

    async updateCustomerDetails(orderId, data) {
      await db.execute(
        `UPDATE orders
         SET recipient_name = ?, contact_number = ?,
             fulfillment_method = ?, delivery_address = ?,
             customer_notes = ?, preferred_schedule = ?
         WHERE order_id = ? AND order_status = 'PENDING'
           AND payment_status = 'PENDING'`,
        [
          data.recipientName,
          data.contactNumber,
          data.fulfillment,
          data.deliveryAddress,
          data.customerNotes,
          data.preferredSchedule,
          orderId,
        ],
      );
    },

    async cancelPendingOrder(orderId) {
      const [result] = await db.execute(
        `UPDATE orders
         SET order_status = 'CANCELLED', payment_status = 'CANCELLED',
             cancelled_at = CURRENT_TIMESTAMP
         WHERE order_id = ? AND order_status = 'PENDING'
           AND payment_status = 'PENDING'`,
        [orderId],
      );
      return result.affectedRows;
    },

    async cancelPendingPayments(orderId) {
      await db.execute(
        `UPDATE payments
         SET payment_status = 'CANCELLED',
             notes = 'Voided: customer cancelled order before cash payment.'
         WHERE order_id = ? AND payment_status = 'PENDING'`,
        [orderId],
      );
    },

    async addCustomerEvent(orderId, userId, oldStatus, newStatus, notes) {
      await db.execute(
        `INSERT INTO order_status_history
         (order_id, old_status, new_status, changed_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, oldStatus, newStatus, userId, notes],
      );
    },

    async orders(customerId, orderNumber = null) {
      const [rows] = await db.execute(
        `SELECT o.order_id AS orderId, o.order_number AS orderNumber,
                o.order_status AS status, o.payment_status AS paymentStatus,
                o.order_channel AS channel,
                o.fulfillment_method AS fulfillment,
                o.recipient_name AS recipientName,
                o.contact_number AS contactNumber,
                o.delivery_address AS deliveryAddress,
                o.customer_notes AS customerNotes,
                DATE_FORMAT(o.preferred_schedule, '%Y-%m-%dT%H:%i') AS preferredSchedule,
                o.ordered_at AS orderedAt,
                CAST(o.subtotal AS DOUBLE) AS subtotal,
                CAST(o.delivery_fee AS DOUBLE) AS deliveryFee,
                CAST(o.total_amount AS DOUBLE) AS total,
                pm.code AS paymentCode, pm.name AS paymentMethod,
                CAST(pay.amount AS DOUBLE) AS paymentAmount,
                pay.payment_status AS recordedPaymentStatus,
                EXISTS(SELECT 1 FROM work_orders wo WHERE wo.order_id = o.order_id
                  AND wo.status <> 'CANCELLED') AS hasWorkOrder,
                EXISTS(SELECT 1 FROM payments pblock WHERE pblock.order_id = o.order_id
                  AND pblock.payment_status <> 'PENDING') AS hasBlockingPayment
         FROM orders o JOIN payment_methods pm
           ON pm.payment_method_id = o.payment_method_id
         LEFT JOIN payments pay ON pay.payment_id = (
           SELECT MAX(pay2.payment_id) FROM payments pay2 WHERE pay2.order_id = o.order_id
         )
         WHERE o.customer_id = ? ${orderNumber ? "AND o.order_number = ?" : ""}
         ORDER BY o.order_id DESC LIMIT ${orderNumber ? 1 : 100}`,
        orderNumber ? [customerId, orderNumber] : [customerId],
      );
      return rows;
    },

    async historyForOrders(orderIds) {
      if (!orderIds.length) return [];
      const placeholders = orderIds.map(() => "?").join(",");
      const [rows] = await db.execute(
        `SELECT order_id AS orderId, old_status AS oldStatus,
                new_status AS newStatus, notes, changed_at AS changedAt
         FROM order_status_history WHERE order_id IN (${placeholders})
         ORDER BY history_id DESC`,
        orderIds,
      );
      return rows;
    },

    async itemsForOrders(orderIds) {
      if (!orderIds.length) return [];
      const placeholders = orderIds.map(() => "?").join(",");
      const [rows] = await db.execute(
        `SELECT oi.order_id AS orderId, oi.variant_id AS variantId,
                oi.product_name_snapshot AS name, oi.model_snapshot AS model,
                oi.quantity AS qty,
                oi.installation_included AS installationIncluded, CAST(oi.unit_price AS DOUBLE) AS price,
                CAST(oi.line_total AS DOUBLE) AS lineTotal,
                CONCAT(CAST(pv.horsepower AS CHAR), 'HP') AS hp
         FROM order_items oi JOIN product_variants pv ON pv.variant_id = oi.variant_id
         WHERE oi.order_id IN (${placeholders}) ORDER BY oi.order_item_id`,
        orderIds,
      );
      return rows;
    },
  };
}
