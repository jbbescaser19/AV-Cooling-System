export function notificationModel(db) {
  return {
    async activeCustomer(userId) {
      const [rows] = await db.execute(
        `SELECT u.user_id
         FROM users u
         JOIN customers c
           ON c.user_id = u.user_id
         WHERE u.user_id = ?
           AND u.account_type = 'CUSTOMER'
           AND u.status = 'ACTIVE'
           AND c.status = 'ACTIVE'
         LIMIT 1`,
        [userId],
      );

      return rows.length > 0;
    },

    async create(userId, type, title, message, targetPath = null) {
      const [result] = await db.execute(
        `INSERT INTO notifications
           (
             user_id,
             notification_type,
             title,
             message,
             target_path
           )
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, message, targetPath],
      );

      return result.insertId;
    },

    async list(userId, unreadOnly, limit, offset) {
      const [rows] = await db.execute(
        `SELECT
           notification_id AS id,
           notification_type AS type,
           title,
           message,
           target_path AS targetPath,
           is_read AS isRead,
           created_at AS createdAt
         FROM notifications
         WHERE user_id = ?
           ${unreadOnly ? "AND is_read = 0" : ""}
         ORDER BY
           created_at DESC,
           notification_id DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      );

      return rows;
    },

    async unreadCount(userId) {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM notifications
         WHERE user_id = ?
           AND is_read = 0`,
        [userId],
      );

      return Number(rows[0]?.total || 0);
    },

    async markRead(userId, notificationId) {
      const [result] = await db.execute(
        `UPDATE notifications
         SET
           is_read = 1,
           read_at = CURRENT_TIMESTAMP
         WHERE notification_id = ?
           AND user_id = ?
           AND is_read = 0`,
        [notificationId, userId],
      );

      return result.affectedRows;
    },

    async owns(userId, notificationId) {
      const [rows] = await db.execute(
        `SELECT notification_id
         FROM notifications
         WHERE notification_id = ?
           AND user_id = ?
         LIMIT 1`,
        [notificationId, userId],
      );

      return rows.length > 0;
    },

    async markAllRead(userId) {
      const [result] = await db.execute(
        `UPDATE notifications
         SET
           is_read = 1,
           read_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND is_read = 0`,
        [userId],
      );

      return result.affectedRows;
    },

    async deleteOne(userId, notificationId) {
      const [result] = await db.execute(
        `DELETE FROM notifications
         WHERE notification_id = ?
           AND user_id = ?`,
        [notificationId, userId],
      );

      return result.affectedRows;
    },

    async deleteAll(userId) {
      const [result] = await db.execute(
        `DELETE FROM notifications
         WHERE user_id = ?
           AND notification_id > 0`,
        [userId],
      );

      return result.affectedRows;
    },

    async findOwnedOrderId(userId, orderNumber) {
      const [rows] = await db.execute(
        `SELECT o.order_id AS id
         FROM orders o
         JOIN customers c
           ON c.customer_id = o.customer_id
         WHERE c.user_id = ?
           AND o.order_number = ?
         LIMIT 1`,
        [userId, orderNumber],
      );

      return rows[0]?.id ?? null;
    },

    async findOwnedServiceId(userId, requestId) {
      const [rows] = await db.execute(
        `SELECT sr.service_request_id AS id
         FROM service_requests sr
         JOIN customers c
           ON c.customer_id = sr.customer_id
         WHERE c.user_id = ?
           AND sr.service_request_id = ?
           AND sr.customer_deleted_at IS NULL
         LIMIT 1`,
        [userId, requestId],
      );

      return rows[0]?.id ?? null;
    },

    async findActivity(kind, recordId) {
      const [rows] = await db.execute(
        `SELECT
           event_code AS code,
           note,
           DATE_FORMAT(
             scheduled_at,
             '%Y-%m-%dT%H:%i'
           ) AS schedule,
           created_at AS createdAt
         FROM fulfillment_events
         WHERE event_kind = ?
           AND record_id = ?
         ORDER BY event_id DESC
         LIMIT 100`,
        [kind, recordId],
      );

      return rows;
    },
  };
}
