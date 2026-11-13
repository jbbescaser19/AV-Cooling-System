/** SQL for the payment management feature. */
export function paymentModel(db) {
  return {
    async cashMethod() {
      return this.enabledMethod("CASH");
    },
    async enabledMethod(code) {
      const [rows] = await db.execute(
        `SELECT payment_method_id AS id FROM payment_methods
         WHERE code=? AND is_enabled=1 LIMIT 1`,
        [code],
      );
      return rows[0]?.id || null;
    },
    async recordPayment(orderId, methodId, total, staffId, notes, paid = true) {
      await db.execute(
        `INSERT INTO payments
         (order_id, payment_method_id, amount, payment_status,paid_at,recorded_by,notes)
         VALUES (?,?,?, ?, ${paid ? "CURRENT_TIMESTAMP" : "NULL"}, ?, ?)`,
        [
          orderId,
          methodId,
          total,
          paid ? "PAID" : "PENDING",
          paid ? staffId : null,
          notes,
        ],
      );
    },
    async payments() {
      const [rows] =
        await db.execute(`SELECT pay.payment_id AS id, o.order_number AS orderNumber,
                    o.order_channel AS channel, o.order_status AS orderStatus,
                    o.recipient_name AS customer, pay.payment_status AS status,
                    pm.code AS method, CAST(pay.amount AS CHAR) AS amount,
                    pay.paid_at AS paidAt, pay.created_at AS createdAt,
                    pay.notes, u.name AS recordedBy,
                    tc.reference_code AS transferReference,
                    NULL AS transferVerifiedAt, tc.submitted_at AS referenceSubmittedAt
             FROM payments pay
             JOIN orders o ON o.order_id = pay.order_id
             JOIN payment_methods pm ON pm.payment_method_id = pay.payment_method_id
             LEFT JOIN users u ON u.user_id = pay.recorded_by
             LEFT JOIN payment_transfer_claims tc ON tc.payment_id=pay.payment_id
             ORDER BY pay.payment_id DESC LIMIT 200`);
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
