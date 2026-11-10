/** SQL for the fulfillmentEvent management feature. */
export function fulfillmentEventModel(db) {
  return {
    async findEventByRequestKey(requestKey) {
      const [rows] = await db.execute(
        `SELECT
               event_kind AS kind,
               record_id AS recordId,
               event_code AS eventCode
             FROM fulfillment_events
             WHERE request_key = ?
             LIMIT 1`,
        [requestKey],
      );
      return rows[0] || null;
    },
    async hasEvent(kind, recordId, eventCode) {
      const [rows] = await db.execute(
        `SELECT event_id
             FROM fulfillment_events
             WHERE event_kind = ?
               AND record_id = ?
               AND event_code = ?
             LIMIT 1`,
        [kind, recordId, eventCode],
      );
      return rows.length > 0;
    },
    async addEvent({
      requestKey,
      kind,
      recordId,
      eventCode,
      staffId,
      note,
      schedule,
    }) {
      await db.execute(
        `INSERT INTO fulfillment_events
               (
                 request_key,
                 event_kind,
                 record_id,
                 event_code,
                 staff_user_id,
                 note,
                 scheduled_at
               )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [requestKey, kind, recordId, eventCode, staffId, note, schedule],
      );
    },
  };
}
