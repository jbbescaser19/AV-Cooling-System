const financialFacts = `
  SELECT
    p.amount AS amount,
    COALESCE(p.paid_at, p.created_at) AS occurred_at,
    'PRODUCT' AS source,
    0 AS is_refund
  FROM payments p
  WHERE p.payment_status = 'PAID'
    OR (
      p.payment_status = 'REFUNDED'
      AND EXISTS (
        SELECT 1
        FROM order_payment_refunds r
        WHERE r.payment_id = p.payment_id
      )
    )

  UNION ALL

  SELECT
    sp.amount,
    COALESCE(sp.paid_at, sp.created_at),
    'SERVICE',
    0
  FROM service_payments sp
  WHERE sp.status = 'PAID'

  UNION ALL

  SELECT
    -r.amount,
    r.refunded_at,
    'PRODUCT',
    1
  FROM order_payment_refunds r

  UNION ALL

  SELECT
    -r.amount,
    r.refunded_at,
    'SERVICE',
    1
  FROM service_payment_refunds r
`;

export function dashboardFinancialModel(db) {
  return {
    async getFinancialRecords({ startDate, endDate, groupBy }) {
      const dateFormat = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

      const [rows] = await db.execute(
        `
        SELECT
          DATE_FORMAT(
            occurred_at,
            '${dateFormat}'
          ) AS bucket,

          COALESCE(SUM(
            CASE
              WHEN source = 'PRODUCT' THEN amount
              ELSE 0
            END
          ), 0) AS productSales,

          COALESCE(SUM(
            CASE
              WHEN source = 'SERVICE' THEN amount
              ELSE 0
            END
          ), 0) AS serviceRevenue,

          COALESCE(SUM(amount), 0) AS totalRevenue,

          COALESCE(SUM(
            CASE
              WHEN is_refund = 1 THEN -amount
              ELSE 0
            END
          ), 0) AS refunds,

          SUM(
            CASE
              WHEN is_refund = 0 THEN 1
              ELSE 0
            END
          ) AS paymentCount

        FROM (${financialFacts}) AS financial_facts

        WHERE occurred_at >= ?
          AND occurred_at < DATE_ADD(?, INTERVAL 1 DAY)

        GROUP BY bucket

        ORDER BY bucket ASC
        `,
        [startDate, endDate],
      );

      return rows;
    },
  };
}
