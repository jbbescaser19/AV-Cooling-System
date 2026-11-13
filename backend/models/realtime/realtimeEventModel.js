/** Only this Model queries the realtime invalidation table. */
export function realtimeEventModel(db) {
  return {
    async record(topics) {
      const [result] = await db.execute(
        "INSERT INTO realtime_change_events (topics) VALUES (?)",
        [JSON.stringify(topics)],
      );
      return result.insertId;
    },
    async latestId() {
      const [[row]] = await db.execute(
        "SELECT COALESCE(MAX(id), 0) AS id FROM realtime_change_events",
      );
      return String(row.id);
    },
    async since(id, limit = 100) {
      const [rows] = await db.execute(
        "SELECT id, topics FROM realtime_change_events WHERE id > ? ORDER BY id ASC LIMIT ?",
        [String(id), limit],
      );
      return rows;
    },
    async cleanup() {
      await db.execute(
        "DELETE FROM realtime_change_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 DAY) LIMIT 1000",
      );
    },
  };
}
