/** Dedicated auditLog database queries. */
export function auditLogModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listAuditLogs(staffId) {
      return select(
        `SELECT l.audit_log_id AS id,l.action,l.module,l.affected_record_type AS recordType,l.affected_record_id AS recordId,u.name AS staff,l.created_at AS createdAt FROM audit_logs l LEFT JOIN users u ON u.user_id=l.user_id ORDER BY l.audit_log_id DESC LIMIT 200`,
      );
    },
    audit(userId, action, module, recordId) {
      return execute(
        `INSERT INTO audit_logs(user_id,action,module,affected_record_type,affected_record_id) VALUES (?,?,?,?,?)`,
        [userId, action, module, module, recordId],
      );
    },
  };
}
