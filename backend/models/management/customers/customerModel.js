/** Dedicated customer database queries. */
export function customerModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listCustomers(staffId) {
      return select(
        `SELECT c.customer_id AS id,u.user_id AS userId,u.name,u.email,c.phone,c.status,u.status AS userStatus,(SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.customer_id) AS orders,(SELECT COUNT(*) FROM service_requests sr WHERE sr.customer_id=c.customer_id) AS services FROM customers c JOIN users u ON u.user_id=c.user_id ORDER BY c.customer_id DESC LIMIT 200`,
      );
    },
    customerForUpdate(id) {
      return select(
        `SELECT c.customer_id,u.user_id AS userId FROM customers c JOIN users u ON u.user_id=c.user_id WHERE c.customer_id=? FOR UPDATE`,
        [id],
      );
    },
    setCustomerStatus(id, userId, status) {
      return Promise.all([
        execute(`UPDATE customers SET status=? WHERE customer_id=?`, [
          status,
          id,
        ]),
        execute(
          `UPDATE users SET status=? WHERE user_id=? AND account_type='CUSTOMER'`,
          [status, userId],
        ),
      ]);
    },
  };
}
