/** Database queries for staff notifications and live inventory warnings. */
export function notificationModel(db) {
  const select = async (sql, params = []) => (await db.execute(sql, params))[0];
  const execute = async (sql, params = []) =>
    (await db.execute(sql, params))[0];

  const stockFrom = `
    FROM product_variants v
    JOIN products p ON p.product_id = v.product_id
    LEFT JOIN inventory i ON i.variant_id = v.variant_id
    WHERE p.status = 'ACTIVE'
      AND v.status = 'ACTIVE'
      AND COALESCE(i.on_hand_quantity, 0) - COALESCE(i.reserved_quantity, 0)
          <= COALESCE(i.reorder_level, 2)
  `;

  return {
    listNotifications(staffId) {
      return select(
        `SELECT notification_id AS id, notification_type AS type, title, message,
                target_path AS targetPath, is_read AS isRead, created_at AS createdAt
         FROM notifications
         WHERE user_id = ?
         ORDER BY notification_id DESC LIMIT 100`,
        [staffId],
      );
    },

    listRecentNotifications(staffId) {
      return select(
        `SELECT notification_id AS id, notification_type AS type, title, message,
                target_path AS targetPath, is_read AS isRead, created_at AS createdAt
         FROM notifications
         WHERE user_id = ?
         ORDER BY notification_id DESC LIMIT 8`,
        [staffId],
      );
    },

    async unreadNotificationCount(staffId) {
      const rows = await select(
        `SELECT COUNT(*) AS total FROM notifications
         WHERE user_id = ? AND is_read = 0`,
        [staffId],
      );
      return Number(rows[0]?.total || 0);
    },

    async lowStockCount() {
      const rows = await select(`SELECT COUNT(*) AS total ${stockFrom}`);
      return Number(rows[0]?.total || 0);
    },

    listLowStock(limit = 6) {
      const safeLimit = Math.min(
        12,
        Math.max(1, Math.trunc(Number(limit) || 6)),
      );
      // The LIMIT is clamped locally, not received as arbitrary SQL.
      return select(
        `SELECT v.variant_id AS id,
                CONCAT(p.brand, ' ', p.model, ' · ', v.horsepower, ' HP') AS name,
                GREATEST(0, COALESCE(i.on_hand_quantity, 0) -
                  COALESCE(i.reserved_quantity, 0)) AS available,
                COALESCE(i.reorder_level, 2) AS reorderLevel
         ${stockFrom}
         ORDER BY available ASC, p.brand, p.model, v.horsepower
         LIMIT ${safeLimit}`,
      );
    },

    notifyStaff(title, message, roles = ["OWNER", "MANAGER"]) {
      if (!roles.length) return Promise.resolve({ affectedRows: 0 });
      const placeholders = roles.map(() => "?").join(",");
      return execute(
        `INSERT INTO notifications (user_id, notification_type, title, message)
         SELECT user_id, 'MANAGEMENT', ?, ?
         FROM users
         WHERE account_type = 'STAFF' AND status = 'ACTIVE'
           AND role IN (${placeholders})`,
        [title, message, ...roles],
      );
    },

    markOwnNotification(id, staffId, read) {
      return execute(
        `UPDATE notifications
         SET is_read = ?, read_at = IF(?, CURRENT_TIMESTAMP, NULL)
         WHERE notification_id = ? AND user_id = ?`,
        [read ? 1 : 0, read ? 1 : 0, id, staffId],
      );
    },

    markAllOwnNotificationsRead(staffId) {
      return execute(
        `UPDATE notifications
         SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND is_read = 0`,
        [staffId],
      );
    },

    deleteOwnNotification(id, staffId) {
      return execute(
        `DELETE FROM notifications WHERE notification_id = ? AND user_id = ?`,
        [id, staffId],
      );
    },

    clearOwnNotifications(staffId) {
      return execute(`DELETE FROM notifications WHERE user_id = ?`, [staffId]);
    },
  };
}
