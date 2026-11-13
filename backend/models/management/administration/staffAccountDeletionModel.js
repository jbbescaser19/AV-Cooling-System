/** Owner-only staff account closure; keeps payment, job and audit history. */
export function staffAccountDeletionModel(db) {
  const select = async (query, params = []) =>
    (await db.execute(query, params))[0];
  const execute = async (query, params = []) =>
    (await db.execute(query, params))[0];
  return {
    async findStaff(userId, lock = false) {
      const list = await select(
        `SELECT user_id AS id, name, email, role, status
         FROM users WHERE user_id=? AND account_type='STAFF'
           AND deleted_at IS NULL LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [userId],
      );
      return list[0] || null;
    },
    async activeTechnicianWork(userId) {
      const list = await select(
        `SELECT COUNT(DISTINCT w.work_order_id) AS activeJobs
         FROM technicians t
         JOIN technician_assignments a ON a.technician_id=t.technician_id
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         WHERE t.user_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status IN ('PENDING','ASSIGNED','IN_PROGRESS')`,
        [userId],
      );
      return Number(list[0]?.activeJobs || 0);
    },
    disableTechnician(userId) {
      return execute(
        `UPDATE technicians SET status='INACTIVE' WHERE user_id=?`,
        [userId],
      );
    },
    async closeStaff(userId, email, passwordHash) {
      return execute(
        `UPDATE users SET status='INACTIVE', name='Deleted staff',
           email=?, password_hash=?, deleted_at=CURRENT_TIMESTAMP
         WHERE user_id=? AND account_type='STAFF' AND role<>'OWNER'
           AND deleted_at IS NULL`,
        [email, passwordHash, userId],
      );
    },
    revokeSessions(userId) {
      return execute(
        `UPDATE staff_sessions SET revoked_at=NOW(3)
         WHERE staff_user_id=? AND revoked_at IS NULL`,
        [userId],
      );
    },
    audit(ownerId, staffId) {
      return execute(
        `INSERT INTO audit_logs
          (user_id,action,module,affected_record_type,affected_record_id)
         VALUES (?,'DELETE_STAFF_ACCOUNT','staff','STAFF',?)`,
        [ownerId, staffId],
      );
    },
  };
}
