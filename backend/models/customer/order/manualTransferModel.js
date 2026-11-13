/** Customer-owned transaction reference claims. SQL belongs in this model only. */
export function manualTransferModel(db) {
  return {
    async lockOrderAndPayment(userId, number) {
      const [rows] = await db.execute(
        `SELECT o.order_id AS orderId, o.order_status AS orderStatus, o.payment_status AS orderPaymentStatus,
      pm.code AS method, p.payment_id AS paymentId, p.payment_status AS paymentStatus
      FROM orders o JOIN customers c ON c.customer_id=o.customer_id
      JOIN payments p ON p.order_id=o.order_id AND p.payment_method_id=o.payment_method_id
      JOIN payment_methods pm ON pm.payment_method_id=o.payment_method_id
      WHERE c.user_id=? AND o.order_number=? AND o.order_channel='ONLINE'
      LIMIT 1 FOR UPDATE`,
        [userId, number],
      );
      return rows[0] || null;
    },
    async existing(paymentId) {
      const [rows] = await db.execute(
        `SELECT claim_id FROM payment_transfer_claims WHERE payment_id=? LIMIT 1`,
        [paymentId],
      );
      return rows[0] || null;
    },
    async create(paymentId, userId, method, reference) {
      const [[used]] = await db.execute(
        `SELECT EXISTS(SELECT 1 FROM service_payments
      WHERE method_code=? AND transfer_reference=?) AS used`,
        [method, reference],
      );
      if (used.used)
        throw Object.assign(
          new Error("This transaction reference is already used."),
          { status: 409 },
        );
      await db.execute(
        `INSERT INTO payment_transfer_claims (payment_id,customer_user_id,method_code,reference_code)
     VALUES (?,?,?,?)`,
        [paymentId, userId, method, reference],
      );
    },
  };
}
