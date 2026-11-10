/** SQL for the order management feature. */
export function orderModel(db) {
  return {
    async orders() {
      const [rows] =
        await db.execute(`SELECT o.order_id AS id, o.order_number AS reference,
                    o.order_channel AS channel, o.recipient_name AS customer,
                    o.order_status AS status, o.payment_status AS paymentStatus,
                    CAST(o.total_amount AS CHAR) AS total,
                    o.ordered_at AS createdAt,
                    DATE_FORMAT(o.preferred_schedule, '%Y-%m-%dT%H:%i') AS schedule,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                        AND e.event_code='ORDER_DELIVERED') AS delivered,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                        AND e.event_code='INSTALLATION_STARTED') AS installationStarted
             FROM orders o ORDER BY o.order_id DESC LIMIT 150`);
      return rows;
    },
    async orderDetails(id) {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_number AS reference,
                    order_channel AS channel, recipient_name AS customer,
                    contact_number AS phone, fulfillment_method AS fulfillment,
                    delivery_address AS address, order_status AS status,
                    payment_status AS paymentStatus,
                    CAST(subtotal AS CHAR) AS subtotal,
                    CAST(discount_amount AS CHAR) AS discount,
                    CAST(total_amount AS CHAR) AS total,
                    DATE_FORMAT(preferred_schedule, '%Y-%m-%dT%H:%i') AS schedule,
                    ordered_at AS createdAt
             FROM orders WHERE order_id = ? LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },
    async orderItems(id) {
      const [rows] = await db.execute(
        `SELECT installation_included AS installationIncluded,
                product_name_snapshot AS name, model_snapshot AS model,
                    quantity, CAST(unit_price AS CHAR) AS unitPrice,
                    CAST(line_total AS CHAR) AS lineTotal
             FROM order_items WHERE order_id = ? ORDER BY order_item_id`,
        [id],
      );
      return rows;
    },
    async confirmFacebookOrder(orderId) {
      const [r] = await db.execute(
        `UPDATE orders SET payment_status='PAID' WHERE order_id=? AND order_channel='FACEBOOK' AND payment_status='PENDING'`,
        [orderId],
      );
      return r.affectedRows;
    },
  };
}
