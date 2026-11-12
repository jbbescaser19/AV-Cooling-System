/**
 * All management order, service,
 * and fulfillment-event SQL lives here.
 */

export function operationsModel(db) {
  return {
    async listOrders() {
      const [rows] = await db.execute(
        `SELECT
           o.order_id AS id,
           o.order_number AS reference,
           o.order_status AS status,
           o.payment_status AS paymentStatus,
           o.recipient_name AS customer,
           o.contact_number AS contact,
           o.delivery_address AS address,
           CAST(o.total_amount AS DOUBLE) AS total,
           DATE_FORMAT(
             o.preferred_schedule,
             '%Y-%m-%dT%H:%i'
           ) AS schedule,
           o.ordered_at AS createdAt,

           EXISTS (
             SELECT 1
             FROM fulfillment_events fe
             WHERE fe.event_kind = 'ORDER'
               AND fe.record_id = o.order_id
               AND fe.event_code = 'ORDER_OUT_FOR_DELIVERY'
           ) AS outForDelivery,

           EXISTS (
             SELECT 1
             FROM fulfillment_events fe
             WHERE fe.event_kind = 'ORDER'
               AND fe.record_id = o.order_id
               AND fe.event_code = 'ORDER_DELIVERED'
           ) AS delivered,

           EXISTS (
             SELECT 1
             FROM fulfillment_events fe
             WHERE fe.event_kind = 'ORDER'
               AND fe.record_id = o.order_id
               AND fe.event_code = 'INSTALLATION_STARTED'
           ) AS installationStarted,

           (
             SELECT GROUP_CONCAT(
               CONCAT(
                 oi.quantity,
                 '× ',
                 oi.product_name_snapshot
               )
               SEPARATOR ', '
             )
             FROM order_items oi
             WHERE oi.order_id = o.order_id
           ) AS products

         FROM orders o
         WHERE o.customer_id IS NOT NULL
           AND o.order_channel = 'ONLINE'
         ORDER BY o.order_id DESC
         LIMIT 100`,
      );

      return rows;
    },

    async listServices() {
      const [rows] = await db.execute(
        `SELECT
           sr.service_request_id AS id,
           sr.service_request_id AS reference,
           sr.facebook_request_id AS facebookRequestId,
           sr.status,
           COALESCE(u.name,fb.customer_name,'Facebook customer') AS customer,
           sr.contact_number AS contact,
           sr.service_address AS address,
           CASE
             WHEN sr.aircon_brand IS NOT NULL
             THEN CONCAT(
               st.service_name, ' · ', sr.aircon_brand, ' ',
               sr.aircon_model, ' · ',
               CAST(sr.aircon_horsepower AS CHAR), ' HP',
               CASE WHEN sr.aircon_source = 'PURCHASED'
                 THEN ' (AV Cooling purchase)'
                 ELSE ' (Customer-owned)' END
             )
             ELSE st.service_name
           END AS products,

           DATE_FORMAT(
             sr.preferred_start,
             '%Y-%m-%dT%H:%i'
           ) AS schedule,

           sr.created_at AS createdAt,
           CAST(sr.service_price AS DOUBLE) AS total,

           EXISTS (
             SELECT 1
             FROM fulfillment_events fe
             WHERE fe.event_kind = 'SERVICE'
               AND fe.record_id = sr.service_request_id
               AND fe.event_code = 'SERVICE_SCHEDULED'
           ) AS serviceScheduled,

           EXISTS (
             SELECT 1
             FROM fulfillment_events fe
             WHERE fe.event_kind = 'SERVICE'
               AND fe.record_id = sr.service_request_id
               AND fe.event_code = 'SERVICE_STARTED'
           ) AS serviceStarted

         FROM service_requests sr
         LEFT JOIN customers c
           ON c.customer_id = sr.customer_id
         LEFT JOIN users u
           ON u.user_id = c.user_id
         LEFT JOIN facebook_order_requests fb ON fb.facebook_request_id=sr.facebook_request_id
         JOIN service_types st
           ON st.service_type_id = sr.service_type_id

         ORDER BY sr.service_request_id DESC
         LIMIT 100`,
      );

      return rows;
    },

    async lockOrder(orderNumber) {
      const [rows] = await db.execute(
        `SELECT
           o.order_id AS id,
           o.order_number AS reference,
           o.order_status AS status,
           o.payment_status AS paymentStatus,
           c.user_id AS userId,

           DATE_FORMAT(
             o.preferred_schedule,
             '%Y-%m-%dT%H:%i'
           ) AS schedule

         FROM orders o
         JOIN customers c
           ON c.customer_id = o.customer_id

         WHERE o.order_number = ?
           AND o.order_channel = 'ONLINE'

         LIMIT 1
         FOR UPDATE`,
        [orderNumber],
      );

      return rows[0] || null;
    },

    async lockService(requestId) {
      const [rows] = await db.execute(
        `SELECT
           sr.service_request_id AS id,
           sr.status,
           c.user_id AS userId,

           DATE_FORMAT(
             sr.preferred_start,
             '%Y-%m-%dT%H:%i'
           ) AS schedule

         FROM service_requests sr
         LEFT JOIN customers c
           ON c.customer_id = sr.customer_id

         WHERE sr.service_request_id = ?

         LIMIT 1
         FOR UPDATE`,
        [requestId],
      );

      return rows[0] || null;
    },

    async findEventByRequestKey(requestKey) {
      const [rows] = await db.execute(
        `SELECT
           event_kind AS kind,
           record_id AS recordId,
           event_code AS eventCode
         FROM fulfillment_events
         WHERE request_key = ?
         LIMIT 1`,
        [requestKey],
      );

      return rows[0] || null;
    },

    async hasEvent(kind, recordId, eventCode) {
      const [rows] = await db.execute(
        `SELECT event_id
         FROM fulfillment_events
         WHERE event_kind = ?
           AND record_id = ?
           AND event_code = ?
         LIMIT 1`,
        [kind, recordId, eventCode],
      );

      return rows.length > 0;
    },

    async addEvent({
      requestKey,
      kind,
      recordId,
      eventCode,
      staffId,
      note,
      schedule,
    }) {
      await db.execute(
        `INSERT INTO fulfillment_events
           (
             request_key,
             event_kind,
             record_id,
             event_code,
             staff_user_id,
             note,
             scheduled_at
           )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [requestKey, kind, recordId, eventCode, staffId, note, schedule],
      );
    },

    async lockPayments(orderId) {
      const [rows] = await db.execute(
        `SELECT
           p.payment_id AS id,
           p.payment_status AS status,
           pm.code AS method
         FROM payments p JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
         WHERE p.order_id = ?
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

    async setOrderStatus(orderId, status, schedule) {
      await db.execute(
        `UPDATE orders
         SET
           order_status = ?,

           preferred_schedule =
             COALESCE(?, preferred_schedule),

           completed_at =
             CASE
               WHEN ? = 'COMPLETED'
               THEN CURRENT_TIMESTAMP
               ELSE completed_at
             END

         WHERE order_id = ?`,
        [status, schedule, status, orderId],
      );
    },

    async addOrderHistory(orderId, previousStatus, nextStatus, staffId, note) {
      await db.execute(
        `INSERT INTO order_status_history
           (
             order_id,
             old_status,
             new_status,
             changed_by,
             notes
           )
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, previousStatus, nextStatus, staffId, note],
      );
    },

    async setServiceStatus(requestId, status, schedule) {
      await db.execute(
        `UPDATE service_requests
         SET
           status = ?,
           preferred_start =
             COALESCE(?, preferred_start)
         WHERE service_request_id = ?`,
        [status, schedule, requestId],
      );
    },
  };
}
