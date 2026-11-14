/** Reports are based only on settled paid records, never submitted references. */
export function reportModel(db) {
  return {
    async listReports() {
      const [rows] = await db.execute(`
        SELECT DATE_FORMAT(tx.paidAt, '%Y-%m') AS period,
               SUM(CASE WHEN tx.kind <> 'SERVICE_REFUND' THEN 1 ELSE 0 END) AS payments,
               SUM(CASE WHEN tx.kind = 'ORDER' THEN 1 ELSE 0 END) AS paidOrders,
               SUM(CASE WHEN tx.kind = 'SERVICE' THEN 1 ELSE 0 END) AS paidServices,
               ROUND(SUM(CASE WHEN tx.kind = 'ORDER' THEN tx.amount ELSE 0 END),2) AS orderRevenue,
               ROUND(SUM(CASE WHEN tx.kind IN ('SERVICE','SERVICE_REFUND') THEN tx.amount ELSE 0 END),2) AS serviceRevenue,
               ROUND(SUM(tx.amount),2) AS revenue
          FROM (
            SELECT p.paid_at AS paidAt,p.amount,'ORDER' AS kind
              FROM payments p WHERE p.payment_status='PAID'
                AND p.paid_at IS NOT NULL
                AND p.paid_at >= DATE_SUB(CURRENT_DATE(),INTERVAL 12 MONTH)
            UNION ALL
            SELECT sp.paid_at AS paidAt,sp.amount,'SERVICE' AS kind
              FROM service_payments sp WHERE sp.status='PAID'
                AND sp.paid_at IS NOT NULL
                AND sp.paid_at >= DATE_SUB(CURRENT_DATE(),INTERVAL 12 MONTH)
            UNION ALL
            SELECT rf.refunded_at AS paidAt, -rf.amount AS amount,
                   'SERVICE_REFUND' AS kind
              FROM service_payment_refunds rf
             WHERE rf.refunded_at >= DATE_SUB(CURRENT_DATE(),INTERVAL 12 MONTH)
          ) tx
         GROUP BY DATE_FORMAT(tx.paidAt,'%Y-%m')
         ORDER BY period DESC
      `);
      return rows;
    },
  };
}
