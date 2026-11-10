/** SQL for the payment management feature. */
export function paymentModel(db) {
  return {
    async lockPayments(orderId) {
      const [rows] = await db.execute(
        `SELECT
               payment_id AS id,
               payment_status AS status
             FROM payments
             WHERE order_id = ?
             FOR UPDATE`,
        [orderId],
      );
      return rows;
    },
    async markPaymentPaid(paymentId, staffId, note) {
      const [result] = await db.execute(
        `UPDATE payments
             SET
               payment_status = 'PAID',
               paid_at = CURRENT_TIMESTAMP,
               recorded_by = ?,
               notes = ?
             WHERE payment_id = ?
               AND payment_status = 'PENDING'`,
        [staffId, note, paymentId],
      );
      return result.affectedRows;
    },
    async markOrderPaymentPaid(orderId) {
      const [result] = await db.execute(
        `UPDATE orders
             SET payment_status = 'PAID'
             WHERE order_id = ?
               AND payment_status = 'PENDING'`,
        [orderId],
      );
      return result.affectedRows;
    },
    async cancelPendingPayments(orderId) {
      await db.execute(
        `UPDATE payments
             SET payment_status = 'CANCELLED'
             WHERE order_id = ?
               AND payment_status = 'PENDING'`,
        [orderId],
      );
    },
    async cancelOrderPayment(orderId) {
      await db.execute(
        `UPDATE orders
             SET
               payment_status = 'CANCELLED',
               cancelled_at = CURRENT_TIMESTAMP
             WHERE order_id = ?`,
        [orderId],
      );
    },
  };
}
