/** SQL only: manually verified cash refunds for service payments. */
export function serviceRefundModel(db) {
  return {
    async requestIdForPayment(paymentId) {
      const [[row]] = await db.execute(
        `SELECT service_request_id AS requestId
         FROM service_payments WHERE service_payment_id=? LIMIT 1`,
        [paymentId],
      );
      return row?.requestId || null;
    },

    async lockRequest(requestId) {
      const [[row]] = await db.execute(
        `SELECT sr.service_request_id AS id, sr.status,
                CASE WHEN c.status='ACTIVE' AND u.status='ACTIVE'
                  THEN c.user_id ELSE NULL END AS customerUserId,
                EXISTS(
                  SELECT 1 FROM fulfillment_events fe
                  WHERE fe.event_kind='SERVICE' AND fe.record_id=sr.service_request_id
                    AND fe.event_code='SERVICE_STARTED'
                ) AS hasStartEvent,
                EXISTS(
                  SELECT 1 FROM work_orders wo
                  WHERE wo.service_request_id=sr.service_request_id
                    AND wo.status IN ('IN_PROGRESS','COMPLETED')
                ) AS workStarted
         FROM service_requests sr
         LEFT JOIN customers c ON c.customer_id=sr.customer_id
         LEFT JOIN users u ON u.user_id=c.user_id
         WHERE sr.service_request_id=? LIMIT 1 FOR UPDATE`,
        [requestId],
      );
      return row || null;
    },

    async lockPayment(paymentId, requestId) {
      const [[row]] = await db.execute(
        `SELECT service_payment_id AS id, service_request_id AS requestId,
                status, method_code AS method, amount
         FROM service_payments
         WHERE service_payment_id=? AND service_request_id=?
         LIMIT 1 FOR UPDATE`,
        [paymentId, requestId],
      );
      return row || null;
    },

    async existingRefund(paymentId) {
      const [[row]] = await db.execute(
        `SELECT refund_id AS id FROM service_payment_refunds
         WHERE service_payment_id=? LIMIT 1`,
        [paymentId],
      );
      return row || null;
    },

    async recordCashRefund(payment, requestId, staffId, reference, reason) {
      const [result] = await db.execute(
        `INSERT INTO service_payment_refunds
           (service_payment_id, service_request_id, amount, method_code,
            refund_reference, reason, recorded_by)
         VALUES (?, ?, ?, 'CASH', ?, ?, ?)`,
        [payment.id, requestId, payment.amount, reference, reason, staffId],
      );
      return result.insertId;
    },

    async auditRefund(staffId, paymentId) {
      await db.execute(
        `INSERT INTO audit_logs
           (user_id, action, module, affected_record_type, affected_record_id)
         VALUES (?, 'CONFIRM_SERVICE_CASH_REFUND', 'service-payments', 'SERVICE_PAYMENT', ?)`,
        [staffId, paymentId],
      );
    },

    async hasUnrefundedPaidPayment(requestId) {
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS countMissing
         FROM service_payments sp
         LEFT JOIN service_payment_refunds rf
           ON rf.service_payment_id = sp.service_payment_id
         WHERE sp.service_request_id=?
           AND sp.status='PAID' AND rf.refund_id IS NULL`,
        [requestId],
      );
      return Number(row?.countMissing || 0) > 0;
    },
  };
}
