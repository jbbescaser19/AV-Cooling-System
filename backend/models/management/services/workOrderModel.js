/** Dedicated workOrder database queries. */
export function workOrderModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listWorkOrders(staffId) {
      return select(`SELECT
                    w.work_order_id AS id,
                    w.order_id AS orderId,
                    w.service_request_id AS serviceRequestId,
                    w.work_type AS workType,
                    w.status,
                    w.recipient_name AS customer,
                    w.contact_number AS phone,
                    w.service_address AS address,
                    DATE_FORMAT(w.scheduled_start,'%Y-%m-%dT%H:%i') AS scheduledStart,
                    w.completion_notes AS notes,
                    (SELECT GROUP_CONCAT(a1.technician_id ORDER BY a1.assignment_id SEPARATOR ',')
                     FROM technician_assignments a1
                     WHERE a1.work_order_id=w.work_order_id AND a1.status<>'CANCELLED') AS technicianIdsCsv,
                    (SELECT a1.technician_id FROM technician_assignments a1
                     WHERE a1.work_order_id=w.work_order_id AND a1.status<>'CANCELLED'
                     ORDER BY a1.assignment_id ASC LIMIT 1) AS technicianId,
                    (SELECT GROUP_CONCAT(u1.name ORDER BY a1.assignment_id SEPARATOR ', ')
                     FROM technician_assignments a1
                     JOIN technicians t1 ON t1.technician_id=a1.technician_id
                     JOIN users u1 ON u1.user_id=t1.user_id
                     WHERE a1.work_order_id=w.work_order_id AND a1.status<>'CANCELLED') AS technician,
                    o.order_channel AS orderChannel,
                    o.payment_status AS paymentStatus,
                    (SELECT d.work_order_id
                     FROM work_orders d
                     WHERE d.order_id=w.order_id AND d.work_type='DELIVERY'
                     ORDER BY (d.status='COMPLETED') DESC,d.work_order_id DESC
                     LIMIT 1) AS deliveryWorkOrderId,
                    (SELECT d.status
                     FROM work_orders d
                     WHERE d.order_id=w.order_id AND d.work_type='DELIVERY'
                     ORDER BY (d.status='COMPLETED') DESC,d.work_order_id DESC
                     LIMIT 1) AS deliveryStatus
                   FROM work_orders w
                   LEFT JOIN orders o ON o.order_id=w.order_id
                   ORDER BY w.work_order_id DESC LIMIT 200`);
    },
    /** Scoped to the authenticated technician's staff user ID, not a client ID. */
    async techJobSummary(staffId) {
      const rows = await select(
        `SELECT
           COUNT(DISTINCT CASE WHEN w.status IN ('ASSIGNED','IN_PROGRESS')
             THEN w.work_order_id END) AS active,
           COUNT(DISTINCT CASE WHEN w.status='ASSIGNED'
             THEN w.work_order_id END) AS awaitingStart,
           COUNT(DISTINCT CASE WHEN w.status='ASSIGNED' AND w.work_type='SERVICE'
             THEN w.work_order_id END) AS pendingServices,
           COUNT(DISTINCT CASE WHEN w.status='ASSIGNED' AND w.work_type IN ('DELIVERY','INSTALLATION')
             THEN w.work_order_id END) AS pendingOrderJobs,
           COUNT(DISTINCT CASE WHEN w.status='IN_PROGRESS'
             THEN w.work_order_id END) AS inProgress,
           COUNT(DISTINCT CASE WHEN w.status='COMPLETED'
             THEN w.work_order_id END) AS completed,
           COUNT(DISTINCT CASE WHEN w.status IN ('ASSIGNED','IN_PROGRESS')
             AND DATE(w.scheduled_start)=CURRENT_DATE()
             THEN w.work_order_id END) AS dueToday
         FROM work_orders w
         JOIN technician_assignments a ON a.work_order_id=w.work_order_id
         JOIN technicians t ON t.technician_id=a.technician_id
         WHERE t.user_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED')
           AND w.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED')`,
        [staffId],
      );
      return rows[0] || {};
    },
    async techJobs(staffId) {
      return select(
        `SELECT
           w.work_order_id AS id,
           w.order_id AS orderId,
           w.service_request_id AS serviceRequestId,
           w.work_type AS workType,
           w.status,
           w.recipient_name AS customer,
           w.contact_number AS phone,
           w.service_address AS address,
           DATE_FORMAT(w.scheduled_start,'%Y-%m-%dT%H:%i') AS scheduledStart,
           (SELECT u1.name FROM technician_assignments a1
             JOIN technicians t1 ON t1.technician_id=a1.technician_id
             JOIN users u1 ON u1.user_id=t1.user_id
             WHERE a1.work_order_id=w.work_order_id AND a1.status<>'CANCELLED'
             ORDER BY a1.assignment_id ASC LIMIT 1) AS teamLeader,
           (SELECT GROUP_CONCAT(u1.name ORDER BY a1.assignment_id SEPARATOR ', ')
             FROM technician_assignments a1
             JOIN technicians t1 ON t1.technician_id=a1.technician_id
             JOIN users u1 ON u1.user_id=t1.user_id
             WHERE a1.work_order_id=w.work_order_id AND a1.status<>'CANCELLED') AS teamMembers,
           o.order_channel AS orderChannel,
           o.payment_status AS paymentStatus,
           EXISTS (
             SELECT 1 FROM work_orders i
             WHERE i.order_id = w.order_id
               AND i.work_type = 'INSTALLATION'
               AND i.status <> 'CANCELLED'
           ) AS hasInstallationJob,
           (SELECT i.status FROM work_orders i
            WHERE i.order_id = w.order_id
              AND i.work_type = 'INSTALLATION'
              AND i.status <> 'CANCELLED'
            ORDER BY i.work_order_id DESC LIMIT 1) AS installationStatus,
           (SELECT d.work_order_id
            FROM work_orders d
            WHERE d.order_id=w.order_id AND d.work_type='DELIVERY'
            ORDER BY (d.status='COMPLETED') DESC,d.work_order_id DESC
            LIMIT 1) AS deliveryWorkOrderId,
           (SELECT d.status
            FROM work_orders d
            WHERE d.order_id=w.order_id AND d.work_type='DELIVERY'
            ORDER BY (d.status='COMPLETED') DESC,d.work_order_id DESC
            LIMIT 1) AS deliveryStatus
         FROM work_orders w
         JOIN technician_assignments a ON a.work_order_id=w.work_order_id
         JOIN technicians t ON t.technician_id=a.technician_id
         LEFT JOIN orders o ON o.order_id=w.order_id
         WHERE t.user_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED')
           AND w.status IN ('ASSIGNED','IN_PROGRESS','COMPLETED')
         ORDER BY CASE w.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END,
                  w.scheduled_start ASC, w.work_order_id DESC
         LIMIT 200`,
        [staffId],
      );
    },
    createWork(data) {
      return execute(
        `INSERT INTO work_orders(order_id,service_request_id,work_type,scheduled_start,status,recipient_name,contact_number,service_address) VALUES (?,?,?,?,?,?,?,?)`,
        [
          data.orderId,
          data.serviceRequestId,
          data.workType,
          data.scheduledStart,
          "PENDING",
          data.customer,
          data.phone,
          data.address,
        ],
      );
    },
    lockWork(id) {
      return select(
        `SELECT *,DATE_FORMAT(scheduled_start,'%Y-%m-%dT%H:%i') AS scheduledStartLocal FROM work_orders WHERE work_order_id=? FOR UPDATE`,
        [id],
      );
    },
    rescheduleRelatedWorkOrders(kind, sourceId, start) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      return execute(
        `UPDATE work_orders SET scheduled_start=?
         WHERE ${field}=? AND status NOT IN ('CANCELLED','COMPLETED')`,
        [start, sourceId],
      );
    },
    rescheduleWork(id, start) {
      return execute(
        `UPDATE work_orders SET scheduled_start=? WHERE work_order_id=?`,
        [start, id],
      );
    },
    updateWork(id, status, notes) {
      return execute(
        `UPDATE work_orders SET status=?,completion_notes=IF(?='',completion_notes,?) WHERE work_order_id=?`,
        [status, notes, notes, id],
      );
    },
    syncAssignmentStatus(workId, status) {
      return execute(
        `UPDATE technician_assignments SET status=?
         WHERE work_order_id=? AND status<>'CANCELLED'`,
        [status, workId],
      );
    },
    addWorkHistory(id, oldStatus, newStatus, staffId, notes) {
      return execute(
        `INSERT INTO work_order_status_history(work_order_id,old_status,new_status,changed_by,notes) VALUES (?,?,?,?,?)`,
        [id, oldStatus, newStatus, staffId, notes],
      );
    },
    async deliveryCompleted(orderId) {
      const rows = await select(
        `SELECT work_order_id FROM work_orders WHERE order_id=? AND work_type='DELIVERY' AND status='COMPLETED' LIMIT 1`,
        [orderId],
      );
      return rows.length > 0;
    },
    existingWorkSource(type, id, workType) {
      return select(
        type === "ORDER"
          ? `SELECT work_order_id FROM work_orders WHERE order_id=? AND work_type=? AND status<>'CANCELLED' LIMIT 1`
          : `SELECT work_order_id FROM work_orders WHERE service_request_id=? AND work_type=? AND status<>'CANCELLED' LIMIT 1`,
        [id, workType],
      );
    },
    workFromFb(fb, kind, serviceRequestId = null) {
      return execute(
        `INSERT INTO work_orders(facebook_request_id,service_request_id,work_type,scheduled_start,status,recipient_name,contact_number,service_address) VALUES (?,?,?,?,'PENDING',?,?,?)`,
        [
          fb.facebook_request_id,
          serviceRequestId,
          kind,
          fb.preferred_schedule.replace("T", " "),
          fb.customer_name,
          fb.contact_number,
          fb.delivery_address,
        ],
      );
    },
    async hasActiveAssignedTeam(workId) {
      const rows = await select(
        `SELECT a.assignment_id FROM technician_assignments a
         JOIN technicians t ON t.technician_id=a.technician_id
         JOIN users u ON u.user_id=t.user_id
         WHERE a.work_order_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND t.status='ACTIVE' AND u.status='ACTIVE' LIMIT 1`,
        [workId],
      );
      return rows.length > 0;
    },
    assignedToStaff(workId, userId) {
      return select(
        `SELECT a.assignment_id FROM technician_assignments a JOIN technicians t ON t.technician_id=a.technician_id WHERE a.work_order_id=? AND t.user_id=? AND a.status<>'CANCELLED' LIMIT 1`,
        [workId, userId],
      );
    },
  };
}
