export function customerAccountModel(db) {
  return {
    /**
     * Retrieve a customer's profile by authenticated user ID.
     */
    findProfileByUserId(userId) {
      return db.execute(
        `SELECT
          u.user_id AS userId,
          u.name AS name,
          u.email AS email,
          c.phone AS phone,
          u.status AS status,
          u.account_type AS accountType,
          c.status AS customerStatus
        FROM users AS u
        INNER JOIN customers AS c
          ON c.user_id = u.user_id
        WHERE u.user_id = ?
          AND u.account_type = 'CUSTOMER'
        LIMIT 1`,
        [userId],
      );
    },
  };
}
