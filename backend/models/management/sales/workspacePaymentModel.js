/** Dedicated payment database queries. */
export function paymentModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    cashMethod() {
      return select(
        `SELECT payment_method_id AS id FROM payment_methods WHERE code='CASH' AND is_enabled=1 LIMIT 1`,
      );
    },
    fbPayment(orderId, methodId, total) {
      return execute(
        `INSERT INTO payments(order_id,payment_method_id,amount,payment_status,notes) VALUES (?,?,?,'PENDING','Facebook Messenger sale - cash not yet collected')`,
        [orderId, methodId, total],
      );
    },
  };
}
