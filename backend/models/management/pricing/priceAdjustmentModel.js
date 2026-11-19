/** SQL for management price adjustments. */
export function priceAdjustmentModel(db) {
  const rows = async (sql, params) => (await db.execute(sql, params))[0];

  return {
    async record(kind, id, lock = false) {
      const sql =
        kind === "ORDER"
          ? `SELECT
                  o.order_id AS id,
                  o.order_number AS reference,
                  o.order_status AS status,
                  o.payment_status AS parentPaymentStatus,
                  (o.order_channel='ONLINE'
                    AND o.customer_id IS NOT NULL) AS online,
                  c.user_id AS customerUserId,
                  o.subtotal AS base,
                  o.delivery_fee AS deliveryFee,
                  o.discount_amount AS discount,
                  o.discount_reason AS discountReason,
                  o.additional_fee_amount AS additionalFee,
                  o.additional_fee_reason AS additionalFeeReason,
                  o.total_amount AS total
             FROM orders o
             LEFT JOIN customers c
               ON c.customer_id=o.customer_id
             WHERE o.order_id=?`
          : `SELECT
                  s.service_request_id AS id,
                  s.status,
                  'PENDING' AS parentPaymentStatus,
                  (s.customer_id IS NOT NULL
                    AND s.pos_request_key IS NULL
                    AND s.facebook_request_id IS NULL
                    AND s.customer_deleted_at IS NULL) AS online,
                  c.user_id AS customerUserId,
                  (s.service_price-s.additional_fee_amount
                    +s.discount_amount) AS base,
                  0 AS deliveryFee,
                  s.discount_amount AS discount,
                  s.discount_reason AS discountReason,
                  s.additional_fee_amount AS additionalFee,
                  s.additional_fee_reason AS additionalFeeReason,
                  s.service_price AS total
             FROM service_requests s
             LEFT JOIN customers c
               ON c.customer_id=s.customer_id
             WHERE s.service_request_id=?`;

      return (await rows(sql + (lock ? " FOR UPDATE" : ""), [id]))[0] || null;
    },

    payments(kind, id, lock = false) {
      const sql =
        kind === "ORDER"
          ? `SELECT
                  payment_id AS id,
                  payment_status AS status,
                  amount,
                  NULL AS transferReference
             FROM payments
             WHERE order_id=?`
          : `SELECT
                  service_payment_id AS id,
                  status,
                  amount,
                  transfer_reference AS transferReference
             FROM service_payments
             WHERE service_request_id=?`;

      return rows(sql + (lock ? " FOR UPDATE" : ""), [id]);
    },

    async hasPaymentLink(kind, paymentId, lock = false) {
      const field =
        kind === "ORDER" ? "order_payment_id" : "service_payment_id";

      return (
        (
          await rows(
            `SELECT checkout_id
             FROM paymongo_checkout_sessions
             WHERE ${field}=?` + (lock ? " FOR UPDATE" : ""),
            [paymentId],
          )
        ).length > 0
      );
    },

    async hasTransferClaim(paymentId, lock = false) {
      return (
        (
          await rows(
            `SELECT claim_id
             FROM payment_transfer_claims
             WHERE payment_id=?` + (lock ? " FOR UPDATE" : ""),
            [paymentId],
          )
        ).length > 0
      );
    },

    async hasWork(kind, id, lock = false) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";

      return (
        (
          await rows(
            `SELECT work_order_id
             FROM work_orders
             WHERE ${field}=?
               AND status<>'CANCELLED'` + (lock ? " FOR UPDATE" : ""),
            [id],
          )
        ).length > 0
      );
    },

    async save(
      kind,
      id,
      paymentId,
      { discount, discountReason, additionalFee, additionalFeeReason, total },
    ) {
      const params = [
        discount,
        discountReason || null,
        additionalFee,
        additionalFeeReason || null,
        total,
        id,
      ];

      const parentSQL =
        kind === "ORDER"
          ? `UPDATE orders
             SET discount_amount=?,
                 discount_reason=?,
                 additional_fee_amount=?,
                 additional_fee_reason=?,
                 total_amount=?
             WHERE order_id=?
               AND order_status='PENDING'
               AND payment_status='PENDING'`
          : `UPDATE service_requests
             SET discount_amount=?,
                 discount_reason=?,
                 additional_fee_amount=?,
                 additional_fee_reason=?,
                 service_price=?,
                 customer_revision=customer_revision+1
             WHERE service_request_id=?
               AND status='PENDING'`;

      const paymentSQL =
        kind === "ORDER"
          ? `UPDATE payments
             SET amount=?
             WHERE payment_id=?
               AND payment_status='PENDING'`
          : `UPDATE service_payments
             SET amount=?
             WHERE service_payment_id=?
               AND status='PENDING'`;

      const [parent] = await db.execute(parentSQL, params);

      await db.execute(paymentSQL, [total, paymentId]);

      if (parent.affectedRows !== 1) {
        throw Object.assign(
          new Error("Record changed. Reload and try again."),
          { status: 409 },
        );
      }
    },
  };
}
