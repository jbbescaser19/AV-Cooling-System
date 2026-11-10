/** Dedicated technician database queries. */
export function technicianModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listTechnicians(staffId) {
      return select(
        `SELECT t.technician_id AS id,t.technician_code AS code,t.user_id AS userId,u.name,u.email,t.status FROM technicians t JOIN users u ON u.user_id=t.user_id ORDER BY t.technician_id DESC LIMIT 200`,
      );
    },
    findTechnician(id) {
      return select(
        `SELECT technician_id,status FROM technicians WHERE technician_id=? LIMIT 1`,
        [id],
      );
    },
    checkTechOff(id, dateTime) {
      const date = String(dateTime).slice(0, 10);
      const start = `${String(dateTime).slice(0, 16).replace("T", " ")}:00`;
      return select(
        `SELECT schedule_id FROM technician_schedules WHERE technician_id=? AND schedule_date=?
         AND status='OFF' AND (start_time IS NULL OR end_time IS NULL OR
         (TIMESTAMP(schedule_date,start_time) < DATE_ADD(?, INTERVAL 2 HOUR)
          AND TIMESTAMP(schedule_date,end_time) > ?)) LIMIT 1`,
        [id, date, start, start],
      );
    },
    checkTechBusy(technicianId, dateTime, omitWorkId = 0) {
      const start = `${String(dateTime).slice(0, 16).replace("T", " ")}:00`;
      return select(
        `SELECT a.assignment_id FROM technician_assignments a
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         WHERE a.technician_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status NOT IN ('CANCELLED','COMPLETED')
           AND w.scheduled_start < DATE_ADD(?, INTERVAL 2 HOUR)
           AND DATE_ADD(w.scheduled_start, INTERVAL 2 HOUR) > ?
           AND w.work_order_id<>? LIMIT 1 FOR UPDATE`,
        [technicianId, start, start, omitWorkId],
      );
    },
    getWorkAssignment(workId) {
      return select(
        `SELECT a.assignment_id,a.technician_id AS technicianId FROM technician_assignments a WHERE a.work_order_id=? AND a.status<>'CANCELLED' LIMIT 1 FOR UPDATE`,
        [workId],
      );
    },
    assignTechnician(workId, technicianId, staffId) {
      return execute(
        `INSERT INTO technician_assignments(work_order_id,technician_id,assigned_by,status) VALUES (?,?,?,'ASSIGNED')`,
        [workId, technicianId, staffId],
      );
    },
    userForTechnician(userId) {
      return select(
        `SELECT user_id FROM users WHERE user_id=? AND account_type='STAFF' AND role='TECHNICIAN' AND status='ACTIVE' LIMIT 1`,
        [userId],
      );
    },
    addTechnician(data) {
      return execute(
        `INSERT INTO technicians(user_id,technician_code,status) VALUES (?,?,'ACTIVE')`,
        [data.userId, data.code],
      );
    },
    updateTechnician(id, status) {
      return execute(`UPDATE technicians SET status=? WHERE technician_id=?`, [
        status,
        id,
      ]);
    },
  };
}
