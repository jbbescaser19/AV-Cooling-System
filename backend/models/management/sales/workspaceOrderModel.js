/** Dedicated order database queries. */
export function orderModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];

  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];

  return {
    findOrder(id) {
      return select(
        `SELECT order_id AS id,
                recipient_name AS customer,
                contact_number AS phone,
                delivery_address AS address,
                order_status AS status
         FROM orders
         WHERE order_id=? LIMIT 1 FOR UPDATE`,
        [id],
      );
    },

    async completeScheduledPosOrder(orderId) {
      return execute(
        `UPDATE orders
         SET order_status='COMPLETED',
             completed_at=CURRENT_TIMESTAMP
         WHERE order_id=?
           AND order_channel='POS'
           AND order_status IN (
             'CONFIRMED','SCHEDULED','IN_PROGRESS'
           )
           AND NOT EXISTS (
             SELECT 1
             FROM work_orders w
             WHERE w.order_id=orders.order_id
               AND w.status NOT IN ('COMPLETED','CANCELLED')
           )`,
        [orderId],
      );
    },

    facebookOrderStatus(orderId, status) {
      return execute(
        `UPDATE orders
         SET order_status=?,
             completed_at=IF(
               ?='COMPLETED',CURRENT_TIMESTAMP,completed_at
             )
         WHERE order_id=?
           AND order_channel='FACEBOOK'
           AND order_status NOT IN ('COMPLETED','CANCELLED')`,
        [status, status, orderId],
      );
    },

    async orderFulfillmentState(orderId) {
      const rows = await select(
        `SELECT o.order_channel AS channel,
                o.payment_status AS paymentStatus,
                pm.code AS paymentMethod
         FROM orders o
         JOIN payment_methods pm
           ON pm.payment_method_id=o.payment_method_id
         WHERE o.order_id=?
         LIMIT 1 FOR UPDATE`,
        [orderId],
      );

      return rows[0] || null;
    },

    fbCreateOrder(
      fb,
      methodId,
      subtotal,
      deliveryFee,
      total,
      staffId,
      reference,
      preferredStart,
    ) {
      return execute(
        `INSERT INTO orders (
           order_number,created_by,payment_method_id,order_channel,
           order_status,payment_status,fulfillment_method,subtotal,
           discount_amount,delivery_fee,total_amount,recipient_name,
           contact_number,delivery_address,customer_notes,
           preferred_schedule
         )
         VALUES (
           ?,?,?,'FACEBOOK','CONFIRMED','PENDING','DELIVERY',
           ?,0,?,?,?,?,?,?,?
         )`,
        [
          reference,
          staffId,
          methodId,
          subtotal,
          deliveryFee,
          total,
          fb.customer_name,
          fb.contact_number,
          fb.delivery_address,
          "Manual Facebook Messenger agreement; installation included",
          preferredStart,
        ],
      );
    },

    fbOrderItem(orderId, v, qty, unit) {
      return execute(
        `INSERT INTO order_items (
           order_id,variant_id,product_name_snapshot,model_snapshot,
           quantity,unit_price,discount_amount,line_total,
           installation_included
         )
         VALUES (?,?,?,?,?,?,0,?,1)`,
        [
          orderId,
          v.variant_id,
          v.product_name,
          v.model,
          qty,
          unit,
          Number(unit) * qty,
        ],
      );
    },
  };
}
