/** Dedicated staff account archive and deletion queries. */
export function staffAccountDeletionModel(db) {
  const select = async (query, params = []) =>
    (await db.execute(query, params))[0];

  const execute = async (query, params = []) =>
    (await db.execute(query, params))[0];

  return {
    async findStaff(userId, lock = false) {
      const list = await select(
        `SELECT user_id AS id, name, email, role, status
         FROM users
         WHERE user_id=?
           AND account_type='STAFF'
           AND deleted_at IS NULL
         LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [userId],
      );

      return list[0] || null;
    },

    async activeTechnicianWork(userId) {
      const list = await select(
        `SELECT COUNT(DISTINCT w.work_order_id) AS activeJobs
         FROM technicians t
         JOIN technician_assignments a
           ON a.technician_id=t.technician_id
         JOIN work_orders w
           ON w.work_order_id=a.work_order_id
         WHERE t.user_id=?
           AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status IN ('PENDING','ASSIGNED','IN_PROGRESS')`,
        [userId],
      );

      return Number(list[0]?.activeJobs || 0);
    },

    technicianProfiles(userId) {
      return select(
        `SELECT technician_id AS id, status
         FROM technicians
         WHERE user_id=?
         ORDER BY technician_id
         FOR UPDATE`,
        [userId],
      );
    },

    disableTechnician(userId) {
      return execute(
        `UPDATE technicians
         SET status='INACTIVE'
         WHERE user_id=?`,
        [userId],
      );
    },

    restoreTechnician(userId, technicianId, status) {
      return execute(
        `UPDATE technicians
         SET status=?
         WHERE user_id=?
           AND technician_id=?`,
        [status, userId, technicianId],
      );
    },

    archiveStaff(userId) {
      return execute(
        `UPDATE users
         SET status='INACTIVE',
             deleted_at=CURRENT_TIMESTAMP,
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='STAFF'
           AND role<>'OWNER'
           AND deleted_at IS NULL`,
        [userId],
      );
    },

    async findArchivedStaff(userId) {
      const [row] = await select(
        `SELECT user_id AS id, role, status
         FROM users
         WHERE user_id=?
           AND account_type='STAFF'
           AND role<>'OWNER'
           AND deleted_at IS NOT NULL
         FOR UPDATE`,
        [userId],
      );

      return row || null;
    },

    async archiveSnapshot(archiveId) {
      const [row] = await select(
        `SELECT record_snapshot AS snapshot
         FROM management_archive
         WHERE archive_id=?
           AND module_name='staff-accounts'
           AND state='ARCHIVED'
         FOR UPDATE`,
        [archiveId],
      );

      if (!row) return null;

      return typeof row.snapshot === "string"
        ? JSON.parse(row.snapshot)
        : row.snapshot;
    },

    restoreStaff(userId, status) {
      return execute(
        `UPDATE users
         SET status=?,
             deleted_at=NULL,
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='STAFF'
           AND role<>'OWNER'
           AND status='INACTIVE'
           AND deleted_at IS NOT NULL`,
        [status, userId],
      );
    },

    async closeStaff(userId, email, passwordHash) {
      return execute(
        `UPDATE users
         SET status='INACTIVE',
             name='Deleted staff',
             email=?,
             password_hash=?,
             deleted_at=CURRENT_TIMESTAMP,
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='STAFF'
           AND role<>'OWNER'
           AND deleted_at IS NULL`,
        [email, passwordHash, userId],
      );
    },

    purgeStaff(userId, email, passwordHash) {
      return execute(
        `UPDATE users
         SET name='Deleted staff',
             email=?,
             password_hash=?,
             status='INACTIVE',
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='STAFF'
           AND role<>'OWNER'
           AND status='INACTIVE'
           AND deleted_at IS NOT NULL`,
        [email, passwordHash, userId],
      );
    },

    redactArchiveLabel(archiveId, userId) {
      return execute(
        `UPDATE management_archive
         SET record_label=?
         WHERE archive_id=?
           AND state='ARCHIVED'`,
        [`Deleted staff #${userId}`, archiveId],
      );
    },

    revokeSessions(userId) {
      return execute(
        `UPDATE staff_sessions
         SET revoked_at=NOW(3)
         WHERE staff_user_id=?
           AND revoked_at IS NULL`,
        [userId],
      );
    },

    audit(ownerId, staffId) {
      return execute(
        `INSERT INTO audit_logs
          (
            user_id,
            action,
            module,
            affected_record_type,
            affected_record_id
          )
         VALUES (?,'DELETE_STAFF_ACCOUNT','staff','STAFF',?)`,
        [ownerId, staffId],
      );
    },
  };
}
