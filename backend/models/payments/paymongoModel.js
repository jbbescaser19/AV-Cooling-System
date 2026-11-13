/** All PayMongo-related MySQL reads/writes live in this dedicated Model. */
export function paymongoModel(db) {
  return {
    async hasUnsettledCheckout(kind, sourceId) {
      const sql =
        kind === "ORDER"
          ? `SELECT pc.checkout_id FROM paymongo_checkout_sessions pc
           JOIN payments p ON p.payment_id=pc.order_payment_id
           WHERE p.order_id=? AND pc.status IN ('CREATING','ACTIVE') LIMIT 1`
          : `SELECT pc.checkout_id FROM paymongo_checkout_sessions pc
           JOIN service_payments sp ON sp.service_payment_id=pc.service_payment_id
           WHERE sp.service_request_id=? AND pc.status IN ('CREATING','ACTIVE') LIMIT 1`;
      const [rows] = await db.execute(sql, [sourceId]);
      return rows.length > 0;
    },
    async customerOrder(reference, userId) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id, p.amount, p.payment_status AS paymentStatus,
          pm.code AS method, o.order_channel AS channel, o.order_status AS recordStatus,
          o.payment_status AS parentPaymentStatus, o.total_amount AS expectedAmount,
          o.order_number AS reference
         FROM payments p
         JOIN orders o ON o.order_id=p.order_id
         JOIN customers c ON c.customer_id=o.customer_id
         JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
         WHERE o.order_number=? AND c.user_id=? LIMIT 1`,
        [reference, userId],
      );
      return rows[0] || null;
    },
    async customerService(id, userId) {
      const [rows] = await db.execute(
        `SELECT p.service_payment_id AS id, p.amount, p.status AS paymentStatus,
          p.method_code AS method,
          CASE WHEN s.pos_request_key IS NULL THEN 'SERVICE' ELSE 'POS_SERVICE' END AS channel,
          s.status AS recordStatus, p.status AS parentPaymentStatus,
          p.amount AS expectedAmount,
          CONCAT('SERVICE-',s.service_request_id) AS reference
         FROM service_payments p
         JOIN service_requests s ON s.service_request_id=p.service_request_id
         JOIN customers c ON c.customer_id=s.customer_id
         WHERE s.service_request_id=? AND c.user_id=? LIMIT 1`,
        [id, userId],
      );
      return rows[0] || null;
    },
    async staffOrder(id) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id, p.amount, p.payment_status AS paymentStatus,
          pm.code AS method, o.order_channel AS channel, o.order_status AS recordStatus,
          o.payment_status AS parentPaymentStatus, o.total_amount AS expectedAmount,
          o.order_number AS reference
         FROM payments p JOIN orders o ON o.order_id=p.order_id
         JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
         WHERE p.payment_id=? LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },
    async staffService(id) {
      const [rows] = await db.execute(
        `SELECT p.service_payment_id AS id, p.amount, p.status AS paymentStatus,
          p.method_code AS method,
          CASE WHEN s.pos_request_key IS NULL THEN 'SERVICE' ELSE 'POS_SERVICE' END AS channel,
          s.status AS recordStatus, p.status AS parentPaymentStatus,
          p.amount AS expectedAmount,
          CONCAT('SERVICE-',s.service_request_id) AS reference
         FROM service_payments p JOIN service_requests s ON s.service_request_id=p.service_request_id
         WHERE p.service_payment_id=? LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },
    async findByPayment(kind, paymentId, lock = false) {
      const column =
        kind === "ORDER" ? "order_payment_id" : "service_payment_id";
      const [rows] = await db.execute(
        `SELECT * FROM paymongo_checkout_sessions WHERE ${column}=? LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [paymentId],
      );
      return rows[0] || null;
    },
    async create(kind, paymentId, requestKey, amountCentavos, method) {
      const column =
        kind === "ORDER" ? "order_payment_id" : "service_payment_id";
      await db.execute(
        `INSERT INTO paymongo_checkout_sessions
         (${column},request_key,amount_centavos,method_code)
         VALUES (?,?,?,?)`,
        [paymentId, requestKey, amountCentavos, method],
      );
    },
    async retryCreating(checkoutId) {
      await db.execute(
        "UPDATE paymongo_checkout_sessions SET attempted_at=NOW() WHERE checkout_id=? AND status='CREATING'",
        [checkoutId],
      );
    },
    async markActive(checkoutId, sessionId, url) {
      const [result] = await db.execute(
        `UPDATE paymongo_checkout_sessions SET provider_session_id=?,checkout_url=?,status='ACTIVE'
         WHERE checkout_id=? AND status='CREATING'`,
        [sessionId, url, checkoutId],
      );
      return result.affectedRows;
    },
    async lockBySession(sessionId) {
      const [rows] = await db.execute(
        `SELECT * FROM paymongo_checkout_sessions WHERE provider_session_id=? LIMIT 1 FOR UPDATE`,
        [sessionId],
      );
      return rows[0] || null;
    },
    async recordEvent(eventId, sessionId) {
      const [r] = await db.execute(
        `INSERT IGNORE INTO paymongo_webhook_events (event_id,provider_session_id) VALUES (?,?)`,
        [eventId, sessionId],
      );
      return r.affectedRows === 1;
    },
    async lockOrderPayment(id) {
      const [rows] = await db.execute(
        `SELECT p.payment_id AS id,p.payment_status AS status,p.amount,
                o.order_id AS parentId,o.total_amount AS total,o.order_status AS orderStatus,
                o.payment_status AS parentStatus,o.order_channel AS channel,
                o.fulfillment_method AS fulfillment,o.created_by AS creatorId,pm.code AS method
         FROM payments p JOIN orders o ON o.order_id=p.order_id
         JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
         WHERE p.payment_id=? LIMIT 1 FOR UPDATE`,
        [id],
      );
      return rows[0] || null;
    },
    async lockServicePayment(id) {
      const [rows] = await db.execute(
        `SELECT p.service_payment_id AS id,p.status,p.amount,
                s.service_request_id AS parentId,s.status AS orderStatus,
                s.service_price AS total,p.status AS parentStatus,p.method_code AS method
         FROM service_payments p JOIN service_requests s ON s.service_request_id=p.service_request_id
         WHERE p.service_payment_id=? LIMIT 1 FOR UPDATE`,
        [id],
      );
      return rows[0] || null;
    },
    async markOrderPaid(paymentId, orderId, paymentIdProvider) {
      const [p] = await db.execute(
        `UPDATE payments SET payment_status='PAID',paid_at=NOW(),notes=?
         WHERE payment_id=? AND payment_status='PENDING'`,
        [`PayMongo payment ${paymentIdProvider}`, paymentId],
      );
      const [o] = await db.execute(
        `UPDATE orders SET payment_status='PAID' WHERE order_id=? AND payment_status='PENDING'`,
        [orderId],
      );
      return p.affectedRows === 1 && o.affectedRows === 1;
    },
    async markServicePaid(paymentId, paymentIdProvider) {
      const [p] = await db.execute(
        `UPDATE service_payments SET status='PAID',paid_at=NOW(),notes=?
         WHERE service_payment_id=? AND status='PENDING'`,
        [`PayMongo payment ${paymentIdProvider}`, paymentId],
      );
      return p.affectedRows === 1;
    },
    async markCheckoutPaid(checkoutId) {
      await db.execute(
        `UPDATE paymongo_checkout_sessions SET status='PAID',paid_at=NOW()
         WHERE checkout_id=? AND status='ACTIVE'`,
        [checkoutId],
      );
    },
    async auditProviderPayment(kind, id) {
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, module, affected_record_type, affected_record_id)
         VALUES (NULL,'PAYMONGO_PAYMENT_VERIFIED',?, ?, ?)`,
        [
          kind === "ORDER" ? "payments" : "service-payments",
          kind === "ORDER" ? "PAYMENT" : "SERVICE_PAYMENT",
          id,
        ],
      );
    },
    async completePosPickup(orderId) {
      const [r] = await db.execute(
        `UPDATE orders SET order_status='COMPLETED',completed_at=NOW()
         WHERE order_id=? AND order_status='CONFIRMED'
         AND order_channel='POS' AND fulfillment_method='PICKUP'`,
        [orderId],
      );
      return r.affectedRows === 1;
    },
  };
}
