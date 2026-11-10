/**
 * Database operations for Management staff sessions.
 * All session-related SQL stays inside this model.
 */

export function staffSessionModel(db) {
  return {
    async create(sessionId, staffId) {
      await db.execute(
        `INSERT INTO staff_sessions
          (session_id, staff_user_id, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 8 HOUR))`,
        [sessionId, staffId],
      );
    },

    async findActive(sessionId, staffId) {
      const [rows] = await db.execute(
        `SELECT
           u.user_id AS id,
           u.name,
           u.email,
           u.role,
           FLOOR(UNIX_TIMESTAMP(s.last_activity_at) * 1000) AS lastActivityAt,
           FLOOR(UNIX_TIMESTAMP(s.expires_at) * 1000) AS absoluteExpiresAt,
           FLOOR(UNIX_TIMESTAMP(s.reauthenticated_until) * 1000) AS reauthenticatedUntil,
           FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS serverNow
         FROM staff_sessions s
         INNER JOIN users u
           ON u.user_id = s.staff_user_id
         WHERE s.session_id = ?
           AND s.staff_user_id = ?
           AND s.revoked_at IS NULL
           AND s.expires_at > NOW(3)
           AND s.last_activity_at > DATE_SUB(NOW(3), INTERVAL 15 MINUTE)
           AND u.account_type = 'STAFF'
           AND u.status = 'ACTIVE'
           AND u.role IS NOT NULL
         LIMIT 1`,
        [sessionId, staffId],
      );

      return rows[0] || null;
    },

    async recordActivity(sessionId, staffId) {
      const [result] = await db.execute(
        `UPDATE staff_sessions
         SET last_activity_at = NOW(3)
         WHERE session_id = ?
           AND staff_user_id = ?
           AND revoked_at IS NULL
           AND expires_at > NOW(3)
           AND last_activity_at > DATE_SUB(NOW(3), INTERVAL 15 MINUTE)`,
        [sessionId, staffId],
      );

      return result.affectedRows === 1;
    },

    async recordReauthentication(sessionId, staffId) {
      const [result] = await db.execute(
        `UPDATE staff_sessions
         SET reauthenticated_until = LEAST(
           DATE_ADD(NOW(3), INTERVAL 10 MINUTE),
           expires_at
         )
         WHERE session_id = ?
           AND staff_user_id = ?
           AND revoked_at IS NULL
           AND expires_at > NOW(3)
           AND last_activity_at > DATE_SUB(NOW(3), INTERVAL 15 MINUTE)`,
        [sessionId, staffId],
      );

      return result.affectedRows === 1;
    },

    async revokeAllForStaff(staffId) {
      await db.execute(
        `UPDATE staff_sessions
         SET revoked_at = NOW(3)
         WHERE staff_user_id = ?
           AND revoked_at IS NULL`,
        [staffId],
      );
    },

    async revoke(sessionId, staffId) {
      await db.execute(
        `UPDATE staff_sessions
         SET revoked_at = NOW(3)
         WHERE session_id = ?
           AND staff_user_id = ?
           AND revoked_at IS NULL`,
        [sessionId, staffId],
      );
    },
  };
}
