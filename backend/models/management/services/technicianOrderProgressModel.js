/** All SQL for the unified technician order-progress feature. */
export function technicianOrderProgressModel(db) {
  return {
    async lockOrder(orderId) {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_channel AS channel,
                order_status AS status, payment_status AS paymentStatus,
                fulfillment_method AS fulfillment
           FROM orders WHERE order_id = ? FOR UPDATE`,
        [orderId],
      );
      return rows[0] || null;
    },

    async lockActiveJobs(orderId) {
      const [rows] = await db.execute(
        `SELECT work_order_id AS id, work_type AS type, status
           FROM work_orders
          WHERE order_id = ? AND status <> 'CANCELLED'
          ORDER BY work_order_id FOR UPDATE`,
        [orderId],
      );
      return rows;
    },

    async activeTeamMembers(workIds) {
      if (!workIds.length) return [];
      const marks = workIds.map(() => "?").join(", ");
      const [rows] = await db.execute(
        `SELECT a.work_order_id AS workId,
                a.technician_id AS technicianId,
                t.user_id AS userId
           FROM technician_assignments a
           JOIN technicians t ON t.technician_id = a.technician_id
          WHERE a.work_order_id IN (${marks})
            AND a.status <> 'CANCELLED'
          ORDER BY a.work_order_id, a.technician_id`,
        workIds,
      );
      return rows;
    },

    async recordOrderProgress(
      orderId,
      oldStatus,
      newStatus,
      staffId,
      description,
    ) {
      await db.execute(
        `UPDATE orders SET order_status = ?,
                completed_at = CASE WHEN ? = 'COMPLETED'
                  THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
                  ELSE completed_at END
          WHERE order_id = ? AND order_status NOT IN ('CANCELLED', 'COMPLETED')`,
        [newStatus, newStatus, orderId],
      );
      await db.execute(
        `INSERT INTO order_status_history
          (order_id, old_status, new_status, changed_by, notes)
          VALUES (?, ?, ?, ?, ?)`,
        [orderId, oldStatus, newStatus, staffId, description],
      );
    },
  };
}
