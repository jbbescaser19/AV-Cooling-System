/** Payment details for a single saved order. */
export function orderPaymentDetailsModel(db) {
  return {
    async forOrder(orderId) {
      const [rows] = await db.execute(
        `SELECT
           p.payment_id AS id,
           p.payment_status AS status,
           pm.code AS method,
           CAST(p.amount AS CHAR) AS amount,

           rf.refund_reference AS refundReference,
           rf.reason AS refundReason,
           rf.refunded_at AS refundedAt,

           (
             p.payment_status='PAID'
             AND p.paid_at IS NOT NULL
             AND p.amount=o.total_amount
             AND p.amount>0
             AND o.payment_status='PAID'
             AND pm.code='CASH'

             AND o.order_status IN (
               'PENDING','CONFIRMED','SCHEDULED'
             )

             AND rf.refund_id IS NULL

             AND (
               SELECT COUNT(*)
               FROM payments p2
               WHERE p2.order_id=o.order_id
             )=1

             AND EXISTS (
               SELECT 1 FROM stock_reservations sr
               WHERE sr.order_id=o.order_id
                 AND sr.status='ACTIVE'
             )

             AND NOT EXISTS (
               SELECT 1 FROM work_orders w
               WHERE w.order_id=o.order_id
                 AND w.status IN ('IN_PROGRESS','COMPLETED')
             )

             AND NOT EXISTS (
               SELECT 1 FROM fulfillment_events fe
               WHERE fe.event_kind='ORDER'
                 AND fe.record_id=o.order_id
                 AND fe.event_code='ORDER_OUT_FOR_DELIVERY'
             )

             AND NOT EXISTS (
               SELECT 1
               FROM paymongo_checkout_sessions pc
               JOIN payments pp
                 ON pp.payment_id=pc.order_payment_id
               WHERE pp.order_id=o.order_id
                 AND pc.status IN ('CREATING','ACTIVE')
             )
           ) AS canRefund

         FROM orders o

         JOIN payments p
           ON p.order_id=o.order_id

         JOIN payment_methods pm
           ON pm.payment_method_id=p.payment_method_id

         LEFT JOIN order_payment_refunds rf
           ON rf.payment_id=p.payment_id

         WHERE o.order_id=?
         ORDER BY p.payment_id`,
        [orderId],
      );

      return rows.length === 1 ? rows[0] : null;
    },
  };
}
