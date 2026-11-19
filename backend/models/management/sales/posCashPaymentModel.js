/** Deferred cash POS payment reconciliation. */
export function posCashPaymentModel(db) {
  return {
    async lockOrder(reference) {
      const [[row]] = await db.execute(
        `SELECT order_id AS id,
                order_status AS status,
                payment_status AS paymentStatus,
                fulfillment_method AS fulfillment,
                total_amount AS total
         FROM orders
         WHERE order_number=?
           AND order_channel='POS'
         FOR UPDATE`,
        [reference],
      );

      return row || null;
    },

    async lockPayments(orderId) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id,
                p.payment_status AS status,
                p.amount,
                pm.code AS method
         FROM payments p
         JOIN payment_methods pm
           ON pm.payment_method_id=p.payment_method_id
         WHERE p.order_id=?
         ORDER BY p.payment_id
         FOR UPDATE`,
        [orderId],
      );

      return rows;
    },

    async markPaid(orderId, paymentId, staffId, note) {
      const [payment] = await db.execute(
        `UPDATE payments
         SET payment_status='PAID',
             paid_at=CURRENT_TIMESTAMP,
             recorded_by=?,
             notes=?
         WHERE payment_id=?
           AND order_id=?
           AND payment_status='PENDING'`,
        [staffId, note, paymentId, orderId],
      );

      const [order] = await db.execute(
        `UPDATE orders
         SET payment_status='PAID'
         WHERE order_id=?
           AND order_channel='POS'
           AND payment_status='PENDING'`,
        [orderId],
      );

      return payment.affectedRows === 1 && order.affectedRows === 1;
    },

    async completePickup(orderId, staffId) {
      const [result] = await db.execute(
        `UPDATE orders
         SET order_status='COMPLETED',
             completed_at=CURRENT_TIMESTAMP
         WHERE order_id=?
           AND order_channel='POS'
           AND fulfillment_method='PICKUP'
           AND order_status='CONFIRMED'
           AND payment_status='PAID'`,
        [orderId],
      );

      if (result.affectedRows !== 1) return false;

      await db.execute(
        `INSERT INTO order_status_history (
           order_id,old_status,new_status,changed_by,notes
         )
         VALUES (
           ?,'CONFIRMED','COMPLETED',?,
           'Cash collected and products physically handed over'
         )`,
        [orderId, staffId],
      );

      return true;
    },
  };
}
