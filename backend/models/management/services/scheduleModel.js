/** All SQL for technician day-off, meetings, and availability stays here. */
export function scheduleModel(db) {
  const select = async (sql, params = []) => (await db.execute(sql, params))[0];
  const execute = async (sql, params = []) =>
    (await db.execute(sql, params))[0];
  const fields = `s.schedule_id AS id, s.technician_id AS technicianId,
    DATE_FORMAT(s.schedule_date,'%Y-%m-%d') AS date, s.status,
    COALESCE(s.reason,'') AS reason,
    COALESCE(TIME_FORMAT(s.start_time,'%H:%i'),'') AS startTime,
    COALESCE(TIME_FORMAT(s.end_time,'%H:%i'),'') AS endTime`;
  return {
    async listSchedules() {
      return select(`SELECT ${fields}, u.name AS technician
        FROM technician_schedules s JOIN technicians t ON t.technician_id=s.technician_id
        JOIN users u ON u.user_id=t.user_id
        ORDER BY s.schedule_date DESC,s.schedule_id DESC LIMIT 300`);
    },
    async techSchedules(staffId) {
      return select(
        `SELECT ${fields}, u.name AS technician
        FROM technician_schedules s JOIN technicians t ON t.technician_id=s.technician_id
        JOIN users u ON u.user_id=t.user_id WHERE t.user_id=?
        ORDER BY s.schedule_date DESC,s.schedule_id DESC LIMIT 150`,
        [staffId],
      );
    },
    lockSchedule(id) {
      return select(
        `SELECT ${fields} FROM technician_schedules s WHERE s.schedule_id=? FOR UPDATE`,
        [id],
      );
    },
    async lockTechnician(techId) {
      return select(
        `SELECT technician_id,status FROM technicians WHERE technician_id=? FOR UPDATE`,
        [techId],
      );
    },
    async dayRecords(techId, date) {
      return select(
        `SELECT schedule_id AS id,status,
        COALESCE(TIME_FORMAT(start_time,'%H:%i'),'') AS startTime,
        COALESCE(TIME_FORMAT(end_time,'%H:%i'),'') AS endTime
        FROM technician_schedules WHERE technician_id=? AND schedule_date=? FOR UPDATE`,
        [techId, date],
      );
    },
    async busyAssignedJob(techId, date, start, end) {
      if (!start || !end) {
        return select(
          `SELECT w.work_order_id AS id FROM technician_assignments a
          JOIN work_orders w ON w.work_order_id=a.work_order_id
          WHERE a.technician_id=? AND DATE(w.scheduled_start)=?
            AND a.status IN ('ASSIGNED','IN_PROGRESS') AND w.status IN ('ASSIGNED','IN_PROGRESS') LIMIT 1 FOR UPDATE`,
          [techId, date],
        );
      }
      return select(
        `SELECT w.work_order_id AS id FROM technician_assignments a
          JOIN work_orders w ON w.work_order_id=a.work_order_id
          WHERE a.technician_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
            AND w.status IN ('ASSIGNED','IN_PROGRESS')
            AND w.scheduled_start < CONCAT(?, ' ', ?, ':00')
            AND DATE_ADD(w.scheduled_start, INTERVAL 2 HOUR) > CONCAT(?, ' ', ?, ':00')
            LIMIT 1 FOR UPDATE`,
        [techId, date, end, date, start],
      );
    },
    createSchedule(techId, date, status, reason, start, end) {
      return execute(
        `INSERT INTO technician_schedules
        (technician_id,schedule_date,status,reason,start_time,end_time)
        VALUES(?,?,?,?,?,?)`,
        [techId, date, status, reason || null, start || null, end || null],
      );
    },
    updateSchedule(id, status, reason, start, end) {
      return execute(
        `UPDATE technician_schedules
         SET status=?,reason=?,start_time=?,end_time=? WHERE schedule_id=?`,
        [status, reason || null, start || null, end || null, id],
      );
    },
  };
}
