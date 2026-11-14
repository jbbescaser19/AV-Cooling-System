/** Management service-payment reporting and reconciliation SQL. */
export function servicePaymentModel(db) {
  return {
    async list() {
      const [rows] = await db.execute(
        `SELECT
           CONCAT('S', sp.service_payment_id) AS id,
           CONCAT('Service #', sr.service_request_id) AS orderNumber,
           'SERVICE' AS channel,
           sr.status AS orderStatus,
           COALESCE(u.name, sr.walk_in_customer_name, 'Walk-in customer') AS customer,
           CASE WHEN rf.refund_id IS NOT NULL THEN 'REFUNDED' ELSE sp.status END AS status,
           sp.method_code AS method,
           CAST(sp.amount AS CHAR) AS amount,
           sp.paid_at AS paidAt,
           sp.created_at AS createdAt,
           sp.notes,
           staff.name AS recordedBy,
           sp.transfer_reference AS transferReference,
           sp.reference_submitted_at AS referenceSubmittedAt,
           rf.refund_reference AS refundReference,
           rf.refunded_at AS refundedAt
         FROM service_payments sp
         JOIN service_requests sr
           ON sr.service_request_id = sp.service_request_id
         LEFT JOIN service_payment_refunds rf
           ON rf.service_payment_id = sp.service_payment_id
         LEFT JOIN customers c
           ON c.customer_id = sr.customer_id
         LEFT JOIN users u
           ON u.user_id = c.user_id
         LEFT JOIN users staff
           ON staff.user_id = sp.verified_by
         ORDER BY sp.created_at DESC
         LIMIT 200`,
      );

      return rows;
    },

    async forServiceRequest(requestId) {
      const [rows] = await db.execute(
        `SELECT
           sp.service_payment_id AS id,
           sp.service_request_id AS requestId,
           sp.method_code AS method,
           CASE WHEN rf.refund_id IS NOT NULL THEN 'REFUNDED' ELSE sp.status END AS status,
           CAST(sp.amount AS CHAR) AS amount,
           rf.refund_reference AS refundReference,
           rf.reason AS refundReason,
           rf.refunded_at AS refundedAt,
           refundStaff.name AS refundedBy,
           EXISTS (
             SELECT 1 FROM work_orders w
             WHERE w.service_request_id=sr.service_request_id
               AND w.status IN ('IN_PROGRESS','COMPLETED')
           ) AS workStarted,
           sp.transfer_reference AS transferReference,
           sp.reference_submitted_at AS referenceSubmittedAt,
           sp.paid_at AS paidAt,
           sp.created_at AS createdAt,
           sp.notes,
           sr.status AS serviceStatus,
           verifier.name AS verifiedBy
         FROM service_payments sp
         JOIN service_requests sr
           ON sr.service_request_id = sp.service_request_id
         LEFT JOIN users verifier
           ON verifier.user_id = sp.verified_by
         LEFT JOIN service_payment_refunds rf
           ON rf.service_payment_id = sp.service_payment_id
         LEFT JOIN users refundStaff
           ON refundStaff.user_id = rf.recorded_by
         WHERE sp.service_request_id = ?
         LIMIT 1`,
        [requestId],
      );

      return rows[0] || null;
    },

    async serviceRequestExists(requestId) {
      const [rows] = await db.execute(
        `SELECT 1
         FROM service_requests
         WHERE service_request_id = ?
         LIMIT 1`,
        [requestId],
      );

      return rows.length > 0;
    },

    async lockForVerification(id) {
      const [rows] = await db.execute(
        `SELECT
           sp.service_payment_id AS id,
           sp.method_code AS method,
           sp.status,
           sp.transfer_reference AS transferReference,
           sp.amount,
           sp.service_request_id AS requestId,
           sr.status AS requestStatus,
           sr.service_price AS currentServicePrice,
           c.user_id AS customerUserId
         FROM service_payments sp
         JOIN service_requests sr
           ON sr.service_request_id = sp.service_request_id
         LEFT JOIN customers c
           ON c.customer_id = sr.customer_id
         WHERE sp.service_payment_id = ?
         LIMIT 1 FOR UPDATE`,
        [id],
      );

      return rows[0] || null;
    },

    async recordPaid(id, staffId, note) {
      const [result] = await db.execute(
        `UPDATE service_payments
         SET status = 'PAID',
             paid_at = NOW(),
             verified_by = ?,
             notes = ?
         WHERE service_payment_id = ?
           AND status = 'PENDING'`,
        [staffId, note, id],
      );

      return result.affectedRows;
    },

    async audit(staffId, id, kind) {
      await db.execute(
        `INSERT INTO audit_logs
         (user_id, action, module, affected_record_type, affected_record_id)
         VALUES (?, ?, 'service-payments', 'SERVICE_PAYMENT', ?)`,
        [
          staffId,
          kind === "cash" ? "CONFIRM_SERVICE_CASH" : "CONFIRM_SERVICE_TRANSFER",
          id,
        ],
      );
    },
  };
}
