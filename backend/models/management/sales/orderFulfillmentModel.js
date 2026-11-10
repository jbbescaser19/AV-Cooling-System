/** SQL for the order management feature. */
export function orderModel(db) {
  return {
    async listOrders() {
      const [rows] = await db.execute(`SELECT
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
             LIMIT 100`);
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
  };
}
