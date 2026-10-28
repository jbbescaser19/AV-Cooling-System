export function customerModel(db) {
  return {
    findUserByEmail(email) {
      return db.execute(
        `SELECT
          user_id,
          name,
          email,
          password_hash,
          role,
          status,
          account_type
        FROM users
        WHERE email = ?
        LIMIT 1`,
        [email],
      );
    },

    findUserById(userId) {
      return db.execute(
        `SELECT
          u.user_id,
          u.name,
          u.email,
          u.role,
          u.status,
          u.account_type,
          c.status AS customer_status
        FROM users AS u
        INNER JOIN customers AS c
          ON c.user_id = u.user_id
        WHERE u.user_id = ?
          AND u.account_type = 'CUSTOMER'
        LIMIT 1`,
        [userId],
      );
    },

    createUser(
      fullName,
      email,
      accountType,
      passwordHash,
      role = null,
      status = "ACTIVE",
    ) {
      return db.execute(
        `INSERT INTO users
          (name, email, account_type, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fullName, email, accountType, passwordHash, role, status],
      );
    },

    createCustomer(userId, phone, status = "ACTIVE") {
      return db.execute(
        `INSERT INTO customers (user_id, phone, status)
         VALUES (?, ?, ?)`,
        [userId, phone, status],
      );
    },
  };
}
