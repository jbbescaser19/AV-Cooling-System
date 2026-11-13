/**
 * Customer password recovery queries.
 * All SQL for this feature stays in this Model.
 */
export function passwordResetModel(db) {
  return {
    async findActiveCustomer(email) {
      const [rows] = await db.execute(
        `SELECT u.user_id AS id
         FROM users u
         JOIN customers c ON c.user_id = u.user_id
         WHERE u.email = ?
           AND u.account_type = 'CUSTOMER'
           AND u.status = 'ACTIVE'
           AND c.status = 'ACTIVE'
         LIMIT 1`,
        [email],
      );

      return rows[0] || null;
    },

    async lockExisting(email) {
      const [rows] = await db.execute(
        `SELECT
           email,
           user_id AS userId,
           code_hash AS codeHash,
           expires_at AS expiresAt,
           resend_after AS resendAfter,
           window_started_at AS windowStartedAt,
           sends_in_window AS sendsInWindow,
           failed_attempts AS failedAttempts
         FROM customer_password_reset_codes
         WHERE email = ?
         FOR UPDATE`,
        [email],
      );

      return rows[0] || null;
    },

    async countIp(ipHash, now) {
      await db.execute(
        `INSERT INTO customer_password_reset_ip_limits
           (ip_hash, window_started_at, request_count)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
           request_count = IF(
             window_started_at <
               DATE_SUB(VALUES(window_started_at), INTERVAL 1 HOUR),
             1,
             LEAST(65535, request_count + 1)
           ),
           window_started_at = IF(
             window_started_at <
               DATE_SUB(VALUES(window_started_at), INTERVAL 1 HOUR),
             VALUES(window_started_at),
             window_started_at
           )`,
        [ipHash, now],
      );

      const [rows] = await db.execute(
        `SELECT request_count AS count
         FROM customer_password_reset_ip_limits
         WHERE ip_hash = ?
         FOR UPDATE`,
        [ipHash],
      );

      return Number(rows[0]?.count || 0);
    },

    async saveCode({
      email,
      userId,
      codeHash,
      expiresAt,
      resendAfter,
      windowStartedAt,
      sends,
    }) {
      await db.execute(
        `INSERT INTO customer_password_reset_codes
           (
             email,
             user_id,
             code_hash,
             expires_at,
             resend_after,
             window_started_at,
             sends_in_window,
             failed_attempts
           )
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           code_hash = VALUES(code_hash),
           expires_at = VALUES(expires_at),
           resend_after = VALUES(resend_after),
           window_started_at = VALUES(window_started_at),
           sends_in_window = VALUES(sends_in_window),
           failed_attempts = 0`,
        [
          email,
          userId,
          codeHash,
          expiresAt,
          resendAfter,
          windowStartedAt,
          sends,
        ],
      );
    },

    async incrementAttempts(email) {
      await db.execute(
        `UPDATE customer_password_reset_codes
         SET failed_attempts = failed_attempts + 1
         WHERE email = ?`,
        [email],
      );
    },

    async discardUnsent(email, codeHash) {
      await db.execute(
        `DELETE FROM customer_password_reset_codes
         WHERE email = ?
           AND code_hash = ?`,
        [email, codeHash],
      );
    },

    async deleteCode(email) {
      await db.execute(
        `DELETE FROM customer_password_reset_codes
         WHERE email = ?`,
        [email],
      );
    },

    async updatePassword(userId, hashed) {
      const [result] = await db.execute(
        `UPDATE users
         SET
           password_hash = ?,
           session_version = session_version + 1
         WHERE user_id = ?
           AND account_type = 'CUSTOMER'
           AND status = 'ACTIVE'
           AND EXISTS (
             SELECT 1
             FROM customers
             WHERE user_id = ?
               AND status = 'ACTIVE'
           )`,
        [hashed, userId, userId],
      );

      return result.affectedRows;
    },
  };
}
