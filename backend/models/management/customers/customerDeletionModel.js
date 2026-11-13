/** All account-removal data access stays inside this feature-specific model. */
export function customerDeletionModel(db) {
  const rows = async (sql, params = []) => (await db.execute(sql, params))[0];
  const execute = async (sql, params = []) =>
    (await db.execute(sql, params))[0];

  return {
    async ownerPasswordHash(userId) {
      const result = await rows(
        `SELECT password_hash AS passwordHash FROM users
         WHERE user_id=? AND account_type='STAFF' AND role='OWNER'
           AND status='ACTIVE' LIMIT 1`,
        [userId],
      );
      return result[0]?.passwordHash || null;
    },
    async customer(id, lock = false) {
      const result = await rows(
        `SELECT c.customer_id AS id, c.user_id AS userId,
                u.name, u.email, u.status AS userStatus
         FROM customers c JOIN users u ON u.user_id=c.user_id
         WHERE c.customer_id=? AND u.account_type='CUSTOMER'
           AND u.deleted_at IS NULL LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [id],
      );
      return result[0] || null;
    },
    orderRecords(id, lock = false) {
      return rows(
        `SELECT order_id AS id, order_status AS status,
                payment_status AS paymentStatus, order_channel AS channel
         FROM orders WHERE customer_id=? ORDER BY order_id ${lock ? "FOR UPDATE" : ""}`,
        [id],
      );
    },
    serviceRecords(id, lock = false) {
      return rows(
        `SELECT service_request_id AS id, status
         FROM service_requests WHERE customer_id=?
         ORDER BY service_request_id ${lock ? "FOR UPDATE" : ""}`,
        [id],
      );
    },
    orderPayments(id, lock = false) {
      return rows(
        `SELECT payment_status AS status FROM payments
         WHERE order_id=? ORDER BY payment_id ${lock ? "FOR UPDATE" : ""}`,
        [id],
      );
    },
    servicePayments(id, lock = false) {
      return rows(
        `SELECT status FROM service_payments
         WHERE service_request_id=? ORDER BY service_payment_id ${lock ? "FOR UPDATE" : ""}`,
        [id],
      );
    },
    async cancelPendingServicePayments(id) {
      await execute(
        `UPDATE service_payments SET status='CANCELLED'
         WHERE service_request_id=? AND status='PENDING'`,
        [id],
      );
    },
    async removePersonalSettings(customerId) {
      await execute(`DELETE FROM customer_addresses WHERE customer_id=?`, [
        customerId,
      ]);
      await execute(`DELETE FROM carts WHERE customer_id=?`, [customerId]);
    },
    async closeCustomer(customerId) {
      return execute(
        `UPDATE customers SET status='INACTIVE', phone=NULL WHERE customer_id=?`,
        [customerId],
      );
    },
    async closeLogin(userId, redactedEmail, disabledPasswordHash) {
      return execute(
        `UPDATE users SET name='Deleted customer', email=?, password_hash=?,
                status='INACTIVE', session_version=session_version+1,
                deleted_at=CURRENT_TIMESTAMP
         WHERE user_id=? AND account_type='CUSTOMER' AND deleted_at IS NULL`,
        [redactedEmail, disabledPasswordHash, userId],
      );
    },
    async auditDelete(ownerId, customerId) {
      await execute(
        `INSERT INTO audit_logs
          (user_id,action,module,affected_record_type,affected_record_id)
         VALUES (?,'DELETE_CUSTOMER_ACCOUNT','customers','CUSTOMER',?)`,
        [ownerId, customerId],
      );
    },
    async auditCancellation(ownerId, kind, id) {
      await execute(
        `INSERT INTO audit_logs
          (user_id,action,module,affected_record_type,affected_record_id)
         VALUES (?,?,?,?,?)`,
        [
          ownerId,
          "CANCEL_ON_ACCOUNT_DELETION",
          kind === "ORDER" ? "orders" : "service-requests",
          kind,
          id,
        ],
      );
    },
  };
}
