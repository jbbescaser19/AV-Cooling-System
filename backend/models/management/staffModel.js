/**
 * SQL access for management staff accounts.
 * No authentication decisions belong in this model.
 */

export function staffModel(db) {
  return {
    async findActiveByEmail(email) {
      const [rows] = await db.execute(
        `SELECT
           user_id AS id,
           name,
           email,
           role,
           password_hash AS passwordHash
         FROM users
         WHERE email = ?
           AND account_type = 'STAFF'
           AND status = 'ACTIVE'
         LIMIT 1`,
        [email],
      );

      return rows[0] || null;
    },

    async findActiveById(userId) {
      const [rows] = await db.execute(
        `SELECT
           user_id AS id,
           name,
           email,
           role
         FROM users
         WHERE user_id = ?
           AND account_type = 'STAFF'
           AND status = 'ACTIVE'
         LIMIT 1`,
        [userId],
      );

      return rows[0] || null;
    },

    async findActivePasswordHashById(userId) {
      const [rows] = await db.execute(
        `SELECT password_hash AS passwordHash
         FROM users
         WHERE user_id = ? AND account_type = 'STAFF'
           AND status = 'ACTIVE' LIMIT 1`,
        [userId],
      );
      return rows[0]?.passwordHash || null;
    },

    async recordLogin(userId) {
      await db.execute(
        `UPDATE users
         SET last_login_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND account_type = 'STAFF'`,
        [userId],
      );
    },

    async countOwners() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE account_type = 'STAFF'
           AND role = 'OWNER'`,
      );

      return Number(rows[0]?.total ?? 0);
    },

    async createOwner(email, passwordHash) {
      const [result] = await db.execute(
        `INSERT INTO users
           (name, email, account_type,
            password_hash, role, status)
         VALUES
           ('AV Cooling Owner', ?,
            'STAFF', ?, 'OWNER', 'ACTIVE')`,
        [email, passwordHash],
      );

      return result.insertId;
    },
  };
}
