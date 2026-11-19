/** Read upcoming staff agenda. Database access must stay in Models. */
export function upcomingAgendaModel(db) {
  const phNow = "DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)";

  return {
    async upcomingJobs(staffId, technicianOnly) {
      // Technicians see only their assigned jobs.
      // Management roles see the team calendar.
      const scope = technicianOnly
        ? `AND EXISTS (
            SELECT 1 FROM technician_assignments a
            INNER JOIN technicians t
              ON t.technician_id = a.technician_id
            WHERE a.work_order_id = w.work_order_id
              AND t.user_id = ?
              AND a.status IN ('ASSIGNED','IN_PROGRESS')
          )`
        : "";

      const [rows] = await db.execute(
        `SELECT
            MIN(w.work_order_id) AS id,
            CASE
              WHEN SUM(w.work_type = 'DELIVERY') > 0
               AND SUM(w.work_type = 'INSTALLATION') > 0
              THEN 'DELIVERY & INSTALLATION'
              ELSE MIN(w.work_type)
            END AS type,
            DATE_FORMAT(
              w.scheduled_start,
              '%Y-%m-%dT%H:%i'
            ) AS scheduledStart,
            CASE
              WHEN SUM(w.status = 'IN_PROGRESS') > 0
                THEN 'IN_PROGRESS'
              WHEN SUM(w.status = 'ASSIGNED') > 0
                THEN 'ASSIGNED'
              ELSE 'PENDING'
            END AS status
         FROM work_orders w
         WHERE w.status IN ('PENDING','ASSIGNED','IN_PROGRESS')
           AND w.scheduled_start > ${phNow}
           AND w.scheduled_start <= DATE_ADD(
             ${phNow}, INTERVAL 25 HOUR
           )
           ${scope}
         GROUP BY
           CASE
             WHEN w.order_id IS NOT NULL
               AND w.work_type IN ('DELIVERY','INSTALLATION')
             THEN CONCAT('ORDER:', w.order_id)
             ELSE CONCAT('WORK:', w.work_order_id)
           END,
           w.scheduled_start
         ORDER BY scheduledStart ASC, id ASC
         LIMIT 80`,
        technicianOnly ? [staffId] : [],
      );

      return rows;
    },

    async upcomingUnavailabilityForTechnician(staffId) {
      const [rows] = await db.execute(
        `SELECT
            ts.schedule_id AS id,
            DATE_FORMAT(
              TIMESTAMP(
                ts.schedule_date,
                COALESCE(ts.start_time,'09:00:00')
              ),
              '%Y-%m-%dT%H:%i'
            ) AS scheduledStart,
            ts.reason AS reason,
            ts.status
         FROM technician_schedules ts
         JOIN technicians t
           ON t.technician_id = ts.technician_id
         WHERE t.user_id = ?
           AND ts.status = 'OFF'
           AND TIMESTAMP(
             ts.schedule_date,
             COALESCE(ts.start_time,'09:00:00')
           ) > ${phNow}
           AND TIMESTAMP(
             ts.schedule_date,
             COALESCE(ts.start_time,'09:00:00')
           ) <= DATE_ADD(${phNow}, INTERVAL 25 HOUR)
         ORDER BY ts.schedule_date, ts.start_time
         LIMIT 30`,
        [staffId],
      );

      return rows;
    },
  };
}
