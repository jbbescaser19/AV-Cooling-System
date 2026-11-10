/** Dedicated notification database queries. */
export function notificationModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listNotifications(staffId) {
      return select(
        `SELECT notification_id AS id,notification_type AS type,title,message,is_read AS isRead,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY notification_id DESC LIMIT 100`,
        [staffId],
      );
    },
    notifyStaff(title, message, roles = ["OWNER", "MANAGER"]) {
      const placeholders = roles.map(() => "?").join(",");
      return execute(
        `INSERT INTO notifications(user_id,notification_type,title,message) SELECT user_id,'MANAGEMENT',?,? FROM users WHERE account_type='STAFF' AND status='ACTIVE' AND role IN (${placeholders})`,
        [title, message, ...roles],
      );
    },
    markOwnNotification(id, userId, read) {
      return execute(
        `UPDATE notifications SET is_read=?,read_at=IF(?,CURRENT_TIMESTAMP,NULL) WHERE notification_id=? AND user_id=?`,
        [read ? 1 : 0, read ? 1 : 0, id, userId],
      );
    },
  };
}
