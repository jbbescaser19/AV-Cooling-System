/** Read technician availability for a proposed appointment. */
export function technicianAvailabilityModel(db) {
  return {
    async list(date, start, kind, sourceId) {
      const [rows] = await db.execute(
        `SELECT
           t.technician_id AS id,
           u.name,
           (t.status='ACTIVE' AND u.status='ACTIVE') AS active,

           (
             SELECT COALESCE(
               NULLIF(TRIM(s.reason), ''),
               'Day off'
             )
             FROM technician_schedules s
             WHERE s.technician_id=t.technician_id
               AND s.schedule_date=?
               AND s.status='OFF'
               AND (
                 s.start_time IS NULL
                 OR s.end_time IS NULL
                 OR (
                   TIMESTAMP(s.schedule_date,s.start_time)
                     < DATE_ADD(?, INTERVAL 2 HOUR)
                   AND TIMESTAMP(s.schedule_date,s.end_time)>?
                 )
               )
             ORDER BY s.schedule_id
             LIMIT 1
           ) AS offReason,

           EXISTS(
             SELECT 1
             FROM technician_assignments a
             JOIN work_orders w
               ON w.work_order_id=a.work_order_id
             WHERE a.technician_id=t.technician_id
               AND a.status IN ('ASSIGNED','IN_PROGRESS')
               AND w.status NOT IN ('CANCELLED','COMPLETED')
               AND w.scheduled_start
                 < DATE_ADD(?, INTERVAL 2 HOUR)
               AND DATE_ADD(w.scheduled_start, INTERVAL 2 HOUR)>?
               AND NOT (
                 (?='ORDER' AND w.order_id <=> ?)
                 OR
                 (?='SERVICE' AND w.service_request_id <=> ?)
               )
           ) AS busy

         FROM technicians t
         JOIN users u ON u.user_id=t.user_id
         WHERE u.account_type='STAFF'
           AND u.role='TECHNICIAN'
           AND u.deleted_at IS NULL
         ORDER BY u.name,t.technician_id`,

        [date, start, start, start, start, kind, sourceId, kind, sourceId],
      );

      return rows;
    },
  };
}
