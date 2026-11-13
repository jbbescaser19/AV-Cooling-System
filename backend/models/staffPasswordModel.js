/**
 * Dedicated staff password Model.
 * Existing plaintext passwords are never available.
 */
export function staffPasswordModel(db) {
  return {
    async lockStaff(userId) {
      const [rows] = await db.execute(
        `SELECT
           user_id AS id,
           role,
           password_hash AS passwordHash,
           must_change_password AS mustChangePassword
         FROM users
         WHERE user_id = ?
           AND account_type = 'STAFF'
           AND status = 'ACTIVE'
           AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [userId],
      );

      return rows[0] || null;
    },

    async changeOwnPassword(userId, passwordHash) {
      const [result] = await db.execute(
        `UPDATE users
         SET
           password_hash = ?,
           must_change_password = 0
         WHERE user_id = ?
           AND account_type = 'STAFF'
           AND status = 'ACTIVE'`,
        [passwordHash, userId],
      );

      return result.affectedRows;
    },

    async resetStaffPassword(userId, passwordHash) {
      const [result] = await db.execute(
        `UPDATE users
         SET
           password_hash = ?,
           must_change_password = 1
         WHERE user_id = ?
           AND account_type = 'STAFF'
           AND status = 'ACTIVE'
           AND role <> 'OWNER'`,
        [passwordHash, userId],
      );

      return result.affectedRows;
    },

    async audit(actorId, targetId, action) {
      await db.execute(
        `INSERT INTO audit_logs
           (
             user_id,
             action,
             module,
             affected_record_type,
             affected_record_id
           )
         VALUES (?, ?, 'staff', 'STAFF', ?)`,
        [actorId, action, targetId],
      );
    },

    async listResettable() {
      const [rows] = await db.execute(
        `SELECT
           user_id AS id,
           name,
           email,
           role
         FROM users
         WHERE account_type = 'STAFF'
           AND role IN (
             'MANAGER',
             'SALES_CASHIER',
             'TECHNICIAN'
           )
           AND status = 'ACTIVE'
           AND deleted_at IS NULL
         ORDER BY name ASC
         LIMIT 200`,
      );

      return rows;
    },
  };
}
