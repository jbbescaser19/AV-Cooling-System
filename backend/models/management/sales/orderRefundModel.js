/** Full pre-dispatch cash refunds. */
export function orderRefundModel(db) {
  return {
    async orderIdForPayment(paymentId) {
      const [[row]] = await db.execute(
        `SELECT order_id AS id
         FROM payments WHERE payment_id=?`,
        [paymentId],
      );

      return row?.id || null;
    },

    async lockOrder(id) {
      const [[row]] = await db.execute(
        `SELECT o.order_id AS id,
                o.order_number AS reference,
                o.order_status AS status,
                o.payment_status AS paymentStatus,
                o.total_amount AS total,
                (
                  SELECT c.user_id
                  FROM customers c
                  WHERE c.customer_id=o.customer_id
                ) AS userId
         FROM orders o
         WHERE o.order_id=? FOR UPDATE`,
        [id],
      );

      return row || null;
    },

    async lockPayments(orderId) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id,
                p.payment_status AS status,
                p.amount,
                pm.code AS method,
                p.paid_at AS paidAt
         FROM payments p
         JOIN payment_methods pm
           ON pm.payment_method_id=p.payment_method_id
         WHERE p.order_id=?
         ORDER BY p.payment_id FOR UPDATE`,
        [orderId],
      );

      return rows;
    },

    async existing(paymentId) {
      const [[row]] = await db.execute(
        `SELECT refund_id AS refundId,
                refund_reference AS refundReference
         FROM order_payment_refunds
         WHERE payment_id=? FOR UPDATE`,
        [paymentId],
      );

      return row || null;
    },

    async record(payment, orderId, staffId, reference, reason) {
      const [result] = await db.execute(
        `INSERT INTO order_payment_refunds (
           payment_id,
           order_id,
           amount,
           refund_reference,
           reason,
           recorded_by
         )
         VALUES (?,?,?,?,?,?)`,
        [payment.id, orderId, payment.amount, reference, reason, staffId],
      );

      return result.insertId;
    },

    async cancelPaidOrder(orderId, paymentId) {
      const [p] = await db.execute(
        `UPDATE payments
         SET payment_status='REFUNDED'
         WHERE payment_id=?
           AND order_id=?
           AND payment_status='PAID'`,
        [paymentId, orderId],
      );

      const [o] = await db.execute(
        `UPDATE orders
         SET payment_status='REFUNDED',
             order_status='CANCELLED',
             cancelled_at=CURRENT_TIMESTAMP
         WHERE order_id=?
           AND payment_status='PAID'
           AND order_status IN (
             'PENDING','CONFIRMED','SCHEDULED'
           )`,
        [orderId],
      );

      return p.affectedRows === 1 && o.affectedRows === 1;
    },

    async history(order, staffId, note) {
      await db.execute(
        `INSERT INTO order_status_history (
           order_id,
           old_status,
           new_status,
           changed_by,
           notes
         )
         VALUES (?,?,'CANCELLED',?,?)`,
        [order.id, order.status, staffId, note],
      );
    },
  };
}
