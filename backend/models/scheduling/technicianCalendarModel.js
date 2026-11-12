/** Database queries for the signed-in technician's own appointments only. */
export function technicianCalendarModel(db) {
  return {
    async jobsForMonth(staffId, month) {
      const [rows] = await db.execute(
        `SELECT DISTINCT w.work_order_id AS id, w.work_type AS workType, w.status,
                DATE_FORMAT(w.scheduled_start,'%Y-%m-%d') AS date,
                TIME_FORMAT(w.scheduled_start,'%H:%i') AS start,
                w.recipient_name AS customer, w.service_address AS address,
                w.contact_number AS phone,
                COALESCE(o.order_number, CONCAT('Service #',sr.service_request_id),
                  CONCAT('Job #',w.work_order_id)) AS reference,
                (SELECT u2.name FROM technician_assignments a2
                 JOIN technicians t2 ON t2.technician_id=a2.technician_id
                 JOIN users u2 ON u2.user_id=t2.user_id
                 WHERE a2.work_order_id=w.work_order_id AND a2.status<>'CANCELLED'
                 ORDER BY a2.assignment_id LIMIT 1) AS teamLeader,
                (SELECT GROUP_CONCAT(u2.name ORDER BY a2.assignment_id SEPARATOR ', ')
                 FROM technician_assignments a2
                 JOIN technicians t2 ON t2.technician_id=a2.technician_id
                 JOIN users u2 ON u2.user_id=t2.user_id
                 WHERE a2.work_order_id=w.work_order_id AND a2.status<>'CANCELLED') AS teamMembers
         FROM work_orders w
         JOIN technician_assignments a ON a.work_order_id=w.work_order_id
         JOIN technicians t ON t.technician_id=a.technician_id
         LEFT JOIN orders o ON o.order_id=w.order_id
         LEFT JOIN service_requests sr ON sr.service_request_id=w.service_request_id
         WHERE t.user_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status IN ('ASSIGNED','IN_PROGRESS')
           AND DATE_FORMAT(w.scheduled_start,'%Y-%m')=?
         ORDER BY date, start, id`,
        [staffId, month],
      );
      return rows;
    },
    async nextJobs(staffId) {
      const [rows] = await db.execute(
        `SELECT DISTINCT w.work_order_id AS id, w.work_type AS workType,
                w.status, DATE_FORMAT(w.scheduled_start,'%Y-%m-%d') AS date,
                TIME_FORMAT(w.scheduled_start,'%H:%i') AS start,
                COALESCE(o.order_number,CONCAT('Service #',sr.service_request_id),
                  CONCAT('Job #',w.work_order_id)) AS reference
         FROM work_orders w
         JOIN technician_assignments a ON a.work_order_id=w.work_order_id
         JOIN technicians t ON t.technician_id=a.technician_id
         LEFT JOIN orders o ON o.order_id=w.order_id
         LEFT JOIN service_requests sr ON sr.service_request_id=w.service_request_id
         WHERE t.user_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status IN ('ASSIGNED','IN_PROGRESS')
           AND (w.scheduled_start >= NOW() OR w.status='IN_PROGRESS')
         ORDER BY date ASC, start ASC, id ASC LIMIT 5`,
        [staffId],
      );
      return rows;
    },
    async offBlocksForMonth(staffId, month) {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(s.schedule_date,'%Y-%m-%d') AS date,
                COALESCE(TIME_FORMAT(s.start_time,'%H:%i'),'') AS start,
                COALESCE(TIME_FORMAT(s.end_time,'%H:%i'),'') AS end,
                COALESCE(s.reason,'Unavailable') AS reason
         FROM technician_schedules s
         JOIN technicians t ON t.technician_id=s.technician_id
         WHERE t.user_id=? AND s.status='OFF'
           AND DATE_FORMAT(s.schedule_date,'%Y-%m')=?
         ORDER BY s.schedule_date,s.start_time`,
        [staffId, month],
      );
      return rows;
    },
  };
}
