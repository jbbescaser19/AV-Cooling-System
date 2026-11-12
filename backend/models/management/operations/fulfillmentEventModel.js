/**
 * SQL for the Management fulfillment-event feature.
 * All database queries remain inside this Model.
 */
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
      internalNote = null,
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
           internal_note,
           scheduled_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestKey,
          kind,
          recordId,
          eventCode,
          staffId,
          note,
          internalNote,
          schedule,
        ],
      );
    },

    async serviceExists(requestId) {
      const [rows] = await db.execute(
        `SELECT 1
         FROM service_requests
         WHERE service_request_id = ?
         LIMIT 1`,
        [requestId],
      );

      return rows.length > 0;
    },

    async technicianAssignedToService(staffId, requestId) {
      const [rows] = await db.execute(
        `SELECT 1
         FROM technician_assignments a
         JOIN technicians t
           ON t.technician_id = a.technician_id
         JOIN work_orders w
           ON w.work_order_id = a.work_order_id
         WHERE t.user_id = ?
           AND w.service_request_id = ?
           AND a.status <> 'CANCELLED'
           AND w.status <> 'CANCELLED'
         LIMIT 1`,
        [staffId, requestId],
      );

      return rows.length > 0;
    },

    async serviceActivity(requestId) {
      const [rows] = await db.execute(
        `SELECT
           fe.event_id AS id,
           fe.event_code AS code,
           fe.note AS customerReason,
           fe.internal_note AS internalNote,

           DATE_FORMAT(
             fe.scheduled_at,
             '%Y-%m-%dT%H:%i'
           ) AS schedule,

           DATE_FORMAT(
             fe.created_at,
             '%Y-%m-%dT%H:%i:%s'
           ) AS createdAt,

           u.name AS staffName,
           u.role AS staffRole

         FROM fulfillment_events fe

         LEFT JOIN users u
           ON u.user_id = fe.staff_user_id

         WHERE fe.event_kind = 'SERVICE'
           AND fe.record_id = ?

         ORDER BY fe.event_id DESC
         LIMIT 100`,
        [requestId],
      );

      return rows;
    },
  };
}
