/** Work-order history SQL. Source can be an installation, delivery, or service. */
export function workHistoryModel(db) {
  return {
    async record(id) {
      const [[row]] = await db.execute(
        `SELECT w.work_order_id AS id,w.work_type AS workType,w.status,
           w.recipient_name AS customer,w.completion_notes AS completionNotes,
           w.order_id AS orderId,w.service_request_id AS serviceRequestId
         FROM work_orders w WHERE w.work_order_id=? LIMIT 1`,
        [id],
      );
      return row || null;
    },
    async isTechnicianAssigned(id, staffId) {
      const [[row]] = await db.execute(
        `SELECT a.assignment_id FROM technician_assignments a
         JOIN technicians t ON t.technician_id=a.technician_id
         WHERE a.work_order_id=? AND t.user_id=? LIMIT 1`,
        [id, staffId],
      );
      return Boolean(row);
    },
    async events(id) {
      const [rows] = await db.execute(
        `SELECT h.history_id AS id,h.old_status AS oldStatus,h.new_status AS newStatus,
           h.notes,h.changed_at AS changedAt,COALESCE(u.name,'Former staff') AS staffName,
           u.role AS staffRole FROM work_order_status_history h
         LEFT JOIN users u ON u.user_id=h.changed_by
         WHERE h.work_order_id=? ORDER BY h.changed_at DESC,h.history_id DESC`,
        [id],
      );
      return rows;
    },
  };
}
