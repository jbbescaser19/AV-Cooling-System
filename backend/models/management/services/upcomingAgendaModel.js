/** Read upcoming staff agenda. Database access must stay in Models. */
export function upcomingAgendaModel(db) {
  const phNow = "DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)";
  return {
    async upcomingJobs(staffId, technicianOnly) {
      // A technician sees only assigned jobs; management roles see the team calendar.
      const scope = technicianOnly
        ? `AND EXISTS (
            SELECT 1 FROM technician_assignments a
            INNER JOIN technicians t ON t.technician_id = a.technician_id
            WHERE a.work_order_id = w.work_order_id
              AND t.user_id = ?
              AND a.status IN ('ASSIGNED','IN_PROGRESS')
          )`
        : "";
      const [rows] = await db.execute(
        `SELECT w.work_order_id AS id, w.work_type AS type,
                DATE_FORMAT(w.scheduled_start,'%Y-%m-%dT%H:%i') AS scheduledStart,
                w.status
         FROM work_orders w
         WHERE w.status IN ('PENDING','ASSIGNED','IN_PROGRESS')
           AND w.scheduled_start > ${phNow}
           AND w.scheduled_start <= DATE_ADD(${phNow}, INTERVAL 25 HOUR)
           ${scope}
         ORDER BY w.scheduled_start ASC, w.work_order_id ASC
         LIMIT 80`,
        technicianOnly ? [staffId] : [],
      );
      return rows;
    },
    async upcomingUnavailabilityForTechnician(staffId) {
      const [rows] = await db.execute(
        `SELECT ts.schedule_id AS id,
                DATE_FORMAT(TIMESTAMP(ts.schedule_date,COALESCE(ts.start_time,'09:00:00')),
                  '%Y-%m-%dT%H:%i') AS scheduledStart,
                ts.reason AS reason,
                ts.status
           FROM technician_schedules ts
           JOIN technicians t ON t.technician_id=ts.technician_id
          WHERE t.user_id=? AND ts.status='OFF'
            AND TIMESTAMP(ts.schedule_date,COALESCE(ts.start_time,'09:00:00')) > ${phNow}
            AND TIMESTAMP(ts.schedule_date,COALESCE(ts.start_time,'09:00:00'))
                <= DATE_ADD(${phNow}, INTERVAL 25 HOUR)
          ORDER BY ts.schedule_date,ts.start_time LIMIT 30`,
        [staffId],
      );
      return rows;
    },
  };
}
