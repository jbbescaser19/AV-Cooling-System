/** SQL used to create/assign field work when an order or service is confirmed. */
export function confirmationWorkOrderModel(db) {
  return {
    async orderSource(orderId) {
      const [[row]] = await db.execute(
        `SELECT o.order_id AS id, o.order_channel AS channel,
                o.order_status AS status, o.recipient_name AS customer,
                o.contact_number AS phone, o.delivery_address AS address,
                o.fulfillment_method AS fulfillment,
                DATE_FORMAT(o.preferred_schedule,'%Y-%m-%dT%H:%i') AS schedule,
                EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.order_id AND i.installation_included=1) AS installationIncluded
           FROM orders o WHERE o.order_id=?`,
        [orderId],
      );
      return row || null;
    },
    async serviceSource(serviceId) {
      const [[row]] = await db.execute(
        `SELECT s.service_request_id AS id, s.status,
                COALESCE(u.name,f.customer_name,s.walk_in_customer_name,'Service customer') AS customer,
                s.contact_number AS phone, s.service_address AS address,
                DATE_FORMAT(s.preferred_start,'%Y-%m-%dT%H:%i') AS schedule
           FROM service_requests s
           LEFT JOIN customers c ON c.customer_id=s.customer_id
           LEFT JOIN users u ON u.user_id=c.user_id
           LEFT JOIN facebook_order_requests f ON f.facebook_request_id=s.facebook_request_id
          WHERE s.service_request_id=?`,
        [serviceId],
      );
      return row || null;
    },
    async activeWork(kind, sourceId, type) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [rows] = await db.execute(
        `SELECT work_order_id AS id, status FROM work_orders
          WHERE ${field}=? AND work_type=? AND status<>'CANCELLED'
          ORDER BY work_order_id ASC LIMIT 1 FOR UPDATE`,
        [sourceId, type],
      );
      return rows[0] || null;
    },
    async workForSource(kind, sourceId) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [rows] = await db.execute(
        `SELECT work_order_id AS id, status, work_type AS type FROM work_orders
          WHERE ${field}=? AND status<>'CANCELLED'
          ORDER BY work_order_id ASC FOR UPDATE`,
        [sourceId],
      );
      return rows;
    },
    async createWork(kind, source, workType, scheduled) {
      const [result] = await db.execute(
        `INSERT INTO work_orders
          (order_id, service_request_id, work_type, scheduled_start, status,
           recipient_name, contact_number, service_address)
         VALUES (?,?,?,?, 'PENDING',?,?,?)`,
        [
          kind === "ORDER" ? source.id : null,
          kind === "SERVICE" ? source.id : null,
          workType,
          scheduled.replace("T", " ") + ":00",
          source.customer || "Customer",
          source.phone || "",
          source.address || "",
        ],
      );
      return result.insertId;
    },
    async history(workId, oldStatus, newStatus, staffId, note) {
      await db.execute(
        `INSERT INTO work_order_status_history
          (work_order_id,old_status,new_status,changed_by,notes)
         VALUES(?,?,?,?,?)`,
        [workId, oldStatus, newStatus, staffId, note],
      );
    },
    async lockActiveTechnician(id) {
      const [rows] = await db.execute(
        `SELECT t.technician_id AS id FROM technicians t
         INNER JOIN users u ON u.user_id=t.user_id
         WHERE t.technician_id=? AND t.status='ACTIVE'
           AND u.account_type='STAFF' AND u.role='TECHNICIAN' AND u.status='ACTIVE'
         FOR UPDATE`,
        [id],
      );
      return rows[0] || null;
    },
    async technicianIsOff(id, dateTime) {
      const day = String(dateTime).slice(0, 10);
      const start = `${String(dateTime).slice(0, 16).replace("T", " ")}:00`;
      const [rows] = await db.execute(
        `SELECT schedule_id FROM technician_schedules
         WHERE technician_id=? AND schedule_date=? AND status='OFF'
         AND (start_time IS NULL OR end_time IS NULL OR
         (TIMESTAMP(schedule_date,start_time) < DATE_ADD(?, INTERVAL 2 HOUR)
          AND TIMESTAMP(schedule_date,end_time) > ?)) LIMIT 1`,
        [id, day, start, start],
      );
      return rows.length > 0;
    },
    async technicianBusyOnOtherJob(id, dateTime, kind, sourceId) {
      // Each shared booking slot is two hours. Adjacent slots are allowed;
      // overlapping jobs are not. Keep the same order/service's related
      // delivery and installation jobs excluded from the conflict check.
      const start = `${String(dateTime).slice(0, 16).replace("T", " ")}:00`;
      const [rows] = await db.execute(
        `SELECT w.work_order_id FROM technician_assignments a
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         WHERE a.technician_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND w.status NOT IN ('CANCELLED','COMPLETED')
           AND w.scheduled_start < DATE_ADD(?, INTERVAL 2 HOUR)
           AND DATE_ADD(w.scheduled_start, INTERVAL 2 HOUR) > ?
           AND NOT (
             (?='ORDER' AND w.order_id <=> ?) OR
             (?='SERVICE' AND w.service_request_id <=> ?)
           ) LIMIT 1`,
        [id, start, start, kind, sourceId, kind, sourceId],
      );
      return rows.length > 0;
    },
    async technicianIdsForSource(kind, sourceId) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [rows] = await db.execute(
        `SELECT DISTINCT a.technician_id AS id FROM technician_assignments a
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         WHERE w.${field}=? AND w.status IN ('PENDING','ASSIGNED')
           AND a.status='ASSIGNED' ORDER BY a.technician_id ASC`,
        [sourceId],
      );
      return rows.map((row) => Number(row.id));
    },
    async alreadyAssigned(workId, technicianId) {
      const [rows] = await db.execute(
        `SELECT assignment_id FROM technician_assignments
         WHERE work_order_id=? AND technician_id=? AND status<>'CANCELLED' LIMIT 1`,
        [workId, technicianId],
      );
      return rows.length > 0;
    },
    async assign(workId, technicianId, staffId) {
      await db.execute(
        `INSERT INTO technician_assignments
          (work_order_id,technician_id,assigned_by,status)
         VALUES(?,?,?,'ASSIGNED')`,
        [workId, technicianId, staffId],
      );
    },
    async cancelAssignments(workId) {
      await db.execute(
        `UPDATE technician_assignments SET status='CANCELLED'
         WHERE work_order_id=? AND status IN ('ASSIGNED','IN_PROGRESS')`,
        [workId],
      );
    },
    async markAssigned(workId) {
      await db.execute(
        `UPDATE work_orders SET status='ASSIGNED'
         WHERE work_order_id=? AND status='PENDING'`,
        [workId],
      );
    },
    async rescheduleUnstarted(kind, sourceId, schedule) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      await db.execute(
        `UPDATE work_orders SET scheduled_start=?
         WHERE ${field}=? AND status IN ('PENDING','ASSIGNED')`,
        [schedule.replace("T", " ") + ":00", sourceId],
      );
    },
    /** Read the team for every delivery, installation, or service job. The first
     * current assignment is the team leader (no separate team table needed). */
    async listSourceJobs(kind, sourceId) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [jobs] = await db.execute(
        `SELECT work_order_id AS id, work_type AS type, status
           FROM work_orders
          WHERE ${field}=? AND status <> 'CANCELLED'
          ORDER BY work_order_id`,
        [sourceId],
      );
      for (const job of jobs) {
        const [members] = await db.execute(
          `SELECT a.technician_id AS id, u.name, a.status
             FROM technician_assignments a
             JOIN technicians t ON t.technician_id=a.technician_id
             JOIN users u ON u.user_id=t.user_id
            WHERE a.work_order_id=? AND a.status <> 'CANCELLED'
            ORDER BY a.assignment_id`,
          [job.id],
        );
        job.members = members.map((member) => ({
          ...member,
          id: Number(member.id),
        }));
        job.leader = job.members[0] || null;
      }
      return jobs;
    },
    async lockWorkForTeamUpdate(workId) {
      const [rows] = await db.execute(
        `SELECT work_order_id, order_id, service_request_id, status,
                DATE_FORMAT(scheduled_start,'%Y-%m-%dT%H:%i') AS scheduledStartLocal
           FROM work_orders WHERE work_order_id=? FOR UPDATE`,
        [workId],
      );
      return rows[0] || null;
    },
    async lockSource(kind, sourceId) {
      const table = kind === "ORDER" ? "orders" : "service_requests";
      const key = kind === "ORDER" ? "order_id" : "service_request_id";
      const [rows] = await db.execute(
        `SELECT ${key} AS id FROM ${table} WHERE ${key}=? FOR UPDATE`,
        [sourceId],
      );
      return rows[0] || null;
    },
    async checkReadyForStart(kind, sourceId, type) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [jobs] = await db.execute(
        `SELECT work_order_id AS id, status FROM work_orders
         WHERE ${field}=? AND work_type=? AND status <> 'CANCELLED'
         ORDER BY work_order_id DESC LIMIT 1 FOR UPDATE`,
        [sourceId, type],
      );
      const job = jobs[0];
      if (!job || !["ASSIGNED", "IN_PROGRESS"].includes(job.status)) {
        throw Object.assign(
          new Error(
            `Assign a technician team to the ${type.toLowerCase()} job before starting.`,
          ),
          { status: 409 },
        );
      }
      const [assignments] = await db.execute(
        `SELECT a.assignment_id FROM technician_assignments a
          JOIN technicians t ON t.technician_id=a.technician_id
          JOIN users u ON u.user_id=t.user_id
         WHERE a.work_order_id=? AND a.status IN ('ASSIGNED','IN_PROGRESS')
           AND t.status='ACTIVE' AND u.status='ACTIVE'
         LIMIT 1`,
        [job.id],
      );
      if (!assignments.length) {
        throw Object.assign(
          new Error(
            `Assign an active technician team to the ${type.toLowerCase()} job before starting.`,
          ),
          { status: 409 },
        );
      }
      return job;
    },
    async advanceJobFromEvent(
      kind,
      sourceId,
      type,
      nextStatus,
      staffId,
      label,
    ) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [jobs] = await db.execute(
        `SELECT work_order_id AS id, status FROM work_orders
          WHERE ${field}=? AND work_type=? AND status <> 'CANCELLED'
          ORDER BY work_order_id DESC LIMIT 1 FOR UPDATE`,
        [sourceId, type],
      );
      const job = jobs[0];
      if (!job || job.status === nextStatus || job.status === "COMPLETED")
        return;
      if (nextStatus === "IN_PROGRESS" && job.status !== "ASSIGNED") {
        throw Object.assign(
          new Error("Assign a technician team before starting field work."),
          { status: 409 },
        );
      }
      if (nextStatus === "COMPLETED" && job.status !== "IN_PROGRESS") {
        throw Object.assign(
          new Error("Start the assigned job before marking it completed."),
          { status: 409 },
        );
      }
      await db.execute(
        "UPDATE work_orders SET status=? WHERE work_order_id=?",
        [nextStatus, job.id],
      );
      await db.execute(
        `UPDATE technician_assignments SET status=?
          WHERE work_order_id=? AND status IN ('ASSIGNED','IN_PROGRESS')`,
        [nextStatus, job.id],
      );
      await this.history(job.id, job.status, nextStatus, staffId, label);
    },
    async cancelUnstarted(kind, sourceId) {
      const field = kind === "ORDER" ? "order_id" : "service_request_id";
      const [active] = await db.execute(
        `SELECT work_order_id FROM work_orders
         WHERE ${field}=? AND status IN ('IN_PROGRESS','COMPLETED') LIMIT 1 FOR UPDATE`,
        [sourceId],
      );
      if (active.length) {
        throw Object.assign(
          new Error(
            "Field work has started or completed; resolve the work order before cancelling.",
          ),
          { status: 409 },
        );
      }
      await db.execute(
        `UPDATE technician_assignments a
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         SET a.status='CANCELLED'
         WHERE w.${field}=? AND w.status IN ('PENDING','ASSIGNED')
           AND a.status IN ('ASSIGNED','IN_PROGRESS')`,
        [sourceId],
      );
      await db.execute(
        `UPDATE work_orders SET status='CANCELLED'
         WHERE ${field}=? AND status IN ('PENDING','ASSIGNED')`,
        [sourceId],
      );
    },
  };
}
