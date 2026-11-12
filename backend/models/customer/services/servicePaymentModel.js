/** Customer-facing service payment records. All SQL stays in this Model. */
export function servicePaymentModel(db) {
  return {
    async cancelPending(serviceId) {
      const [result] = await db.execute(
        `UPDATE service_payments SET status='CANCELLED'
        WHERE service_request_id=? AND status='PENDING'`,
        [serviceId],
      );
      return result.affectedRows;
    },
    async paymentStatusForCancellation(serviceId) {
      const [[row]] = await db.execute(
        `SELECT status FROM service_payments
        WHERE service_request_id=? LIMIT 1 FOR UPDATE`,
        [serviceId],
      );
      return row?.status || null;
    },
    async createPending(serviceId, code, amount) {
      await db.execute(
        `INSERT INTO service_payments (service_request_id,method_code,amount)
        VALUES (?,?,?)`,
        [serviceId, code, amount],
      );
    },
    async customerPayments(userId) {
      const [rows] = await db.execute(
        `SELECT sp.service_payment_id AS id,
        sr.service_request_id AS requestId, st.service_name AS service,
        sr.status AS serviceStatus, sp.method_code AS method,
        sp.status, CAST(sp.amount AS CHAR) AS amount,
        sp.transfer_reference AS transferReference,
        sp.reference_submitted_at AS referenceSubmittedAt,
        sp.paid_at AS paidAt, sp.created_at AS createdAt
        FROM service_payments sp JOIN service_requests sr ON sr.service_request_id=sp.service_request_id
        JOIN service_types st ON st.service_type_id=sr.service_type_id
        JOIN customers c ON c.customer_id=sr.customer_id
        WHERE c.user_id=? AND sr.customer_deleted_at IS NULL
        ORDER BY sp.created_at DESC LIMIT 150`,
        [userId],
      );
      return rows;
    },
    async lockOwnedRequest(userId, serviceId) {
      const [rows] = await db.execute(
        `SELECT sp.service_payment_id AS id,
        sp.method_code AS method, sp.status,
        sp.transfer_reference AS transferReference,
        sr.status AS serviceStatus
        FROM service_payments sp JOIN service_requests sr
          ON sr.service_request_id=sp.service_request_id
        JOIN customers c ON c.customer_id=sr.customer_id
        WHERE c.user_id=? AND sr.service_request_id=? LIMIT 1 FOR UPDATE`,
        [userId, serviceId],
      );
      return rows[0] || null;
    },
    async referenceExistsInProductPayments(method, reference) {
      const [[row]] = await db.execute(
        `SELECT EXISTS(SELECT 1 FROM payment_transfer_claims
        WHERE method_code=? AND reference_code=?) AS used`,
        [method, reference],
      );
      return Boolean(row.used);
    },
    async reportReference(paymentId, reference) {
      const [result] = await db.execute(
        `UPDATE service_payments
         SET transfer_reference=?,reference_submitted_at=NOW()
         WHERE service_payment_id=? AND transfer_reference IS NULL AND status='PENDING'`,
        [reference, paymentId],
      );
      return result.affectedRows;
    },
  };
}
