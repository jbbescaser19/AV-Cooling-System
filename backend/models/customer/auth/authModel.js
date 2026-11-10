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
          account_type,
          session_version
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
          u.session_version,
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

    async findCustomerSessionById(userId) {
      const [rows] = await db.execute(
        `SELECT
          u.session_version AS sessionVersion,
          u.status AS userStatus,
          c.status AS customerStatus
        FROM users AS u
        INNER JOIN customers AS c
          ON c.user_id = u.user_id
        WHERE u.user_id = ?
          AND u.account_type = 'CUSTOMER'
        LIMIT 1`,
        [userId],
      );

      return rows[0] || null;
    },

    async lockActiveCustomerForPasswordChange(userId) {
      const [rows] = await db.execute(
        `SELECT
          u.user_id AS userId,
          u.password_hash AS passwordHash,
          u.session_version AS sessionVersion
        FROM users AS u
        INNER JOIN customers AS c
          ON c.user_id = u.user_id
        WHERE u.user_id = ?
          AND u.account_type = 'CUSTOMER'
          AND u.status = 'ACTIVE'
          AND c.status = 'ACTIVE'
        LIMIT 1 FOR UPDATE`,
        [userId],
      );

      return rows[0] || null;
    },

    async updateCustomerPassword(
      userId,
      passwordHash,
      previousSessionVersion,
      signOutAllDevices,
    ) {
      const [result] = await db.execute(
        `UPDATE users
         SET
           password_hash = ?,
           session_version = session_version + ?
         WHERE user_id = ?
           AND account_type = 'CUSTOMER'
           AND status = 'ACTIVE'
           AND session_version = ?`,
        [
          passwordHash,
          signOutAllDevices ? 1 : 0,
          userId,
          previousSessionVersion,
        ],
      );

      return result.affectedRows;
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
        `INSERT INTO customers
          (user_id, phone, status)
         VALUES (?, ?, ?)`,
        [userId, phone, status],
      );
    },
  };
}
