/** Dedicated report database queries. */
export function reportModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  return {
    async listReports(staffId) {
      return select(
        `SELECT DATE_FORMAT(p.paid_at,'%Y-%m') AS period,COUNT(*) AS payments,SUM(p.amount) AS revenue FROM payments p WHERE p.payment_status='PAID' AND p.paid_at >= DATE_SUB(CURRENT_DATE(),INTERVAL 12 MONTH) GROUP BY DATE_FORMAT(p.paid_at,'%Y-%m') ORDER BY period DESC`,
      );
    },
  };
}
