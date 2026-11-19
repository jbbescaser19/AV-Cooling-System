/** All SQL for shared appointment slots and their reservations. */
export function bookingScheduleModel(db) {
  return {
    async activeTechnicianCount() {
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM technicians t
         JOIN users u ON u.user_id=t.user_id
         WHERE t.status='ACTIVE'
           AND u.status='ACTIVE'
           AND u.role='TECHNICIAN'
           AND u.account_type='STAFF'`,
      );

      return Number(row?.total || 0);
    },

    async monthStaffBlocks(month) {
      const [rows] = await db.execute(
        `SELECT s.technician_id AS technicianId,
                DATE_FORMAT(s.schedule_date,'%Y-%m-%d') AS date,
                COALESCE(TIME_FORMAT(s.start_time,'%H:%i'),'') AS start,
                COALESCE(TIME_FORMAT(s.end_time,'%H:%i'),'') AS end
         FROM technician_schedules s
         JOIN technicians t
           ON t.technician_id=s.technician_id
         JOIN users u ON u.user_id=t.user_id
         WHERE s.status='OFF'
           AND DATE_FORMAT(s.schedule_date,'%Y-%m')=?
           AND t.status='ACTIVE'
           AND u.status='ACTIVE'
           AND u.role='TECHNICIAN'`,
        [month],
      );

      return rows;
    },

    async availableTechnicians(date, start) {
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM technicians t
         JOIN users u ON u.user_id=t.user_id
         WHERE t.status='ACTIVE'
           AND u.status='ACTIVE'
           AND u.role='TECHNICIAN'
           AND u.account_type='STAFF'
           AND NOT EXISTS (
             SELECT 1
             FROM technician_schedules s
             WHERE s.technician_id=t.technician_id
               AND s.schedule_date=?
               AND s.status='OFF'
               AND (
                 s.start_time IS NULL
                 OR s.end_time IS NULL
                 OR (
                   TIMESTAMP(s.schedule_date,s.start_time)
                     < DATE_ADD(
                         CONCAT(?, ' ', ?, ':00'),
                         INTERVAL 2 HOUR
                       )
                   AND TIMESTAMP(s.schedule_date,s.end_time)
                     > CONCAT(?, ' ', ?, ':00')
                 )
               )
           )`,
        [date, date, start, date, start],
      );

      return Number(row?.total || 0);
    },

    async monthSettings(month) {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(schedule_date,'%Y-%m-%d') AS date,
                TIME_FORMAT(start_time,'%H:%i') AS start,
                capacity,
                is_closed AS closed
         FROM booking_slots
         WHERE DATE_FORMAT(schedule_date,'%Y-%m')=?`,
        [month],
      );

      return rows;
    },

    async monthCounts(month) {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(booking_date,'%Y-%m-%d') AS date,
                TIME_FORMAT(start_time,'%H:%i') AS start,
                COUNT(*) AS booked,
                SUM(expires_at IS NOT NULL) AS held
         FROM booking_reservations
         WHERE DATE_FORMAT(booking_date,'%Y-%m')=?
           AND (
             expires_at IS NULL
             OR expires_at > UTC_TIMESTAMP(3)
           )
         GROUP BY booking_date,start_time`,
        [month],
      );

      return rows;
    },

    async ensureSlot(date, start) {
      await db.execute(
        `INSERT IGNORE INTO booking_slots
           (schedule_date,start_time,capacity,is_closed)
         VALUES (?,?,1,0)`,
        [date, start],
      );
    },

    async lockSlot(date, start) {
      const [rows] = await db.execute(
        `SELECT capacity,is_closed AS closed
         FROM booking_slots
         WHERE schedule_date=?
           AND start_time=?
         FOR UPDATE`,
        [date, start],
      );

      return rows[0];
    },

    async countSlot(date, start) {
      const [rows] = await db.execute(
        `SELECT reservation_id
         FROM booking_reservations
         WHERE booking_date=?
           AND start_time=?
           AND (
             expires_at IS NULL
             OR expires_at > UTC_TIMESTAMP(3)
           )
         FOR UPDATE`,
        [date, start],
      );

      return rows.length;
    },

    async existingBooking(kind, recordId) {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(booking_date,'%Y-%m-%d') AS date,
                TIME_FORMAT(start_time,'%H:%i') AS start,
                expires_at IS NOT NULL AS temporary,
                (
                  expires_at IS NULL
                  OR expires_at > UTC_TIMESTAMP(3)
                ) AS active
         FROM booking_reservations
         WHERE source_kind=?
           AND source_id=?
         FOR UPDATE`,
        [kind, recordId],
      );

      return rows[0] || null;
    },

    async sourceState(kind, recordId) {
      const statements = {
        ORDER: `
          SELECT
            o.order_status AS status,
            o.customer_id AS customerId,
            (
              SELECT c.user_id
              FROM customers c
              WHERE c.customer_id=o.customer_id
            ) AS userId,
            o.order_number AS reference,
            DATE_FORMAT(
              o.preferred_schedule,
              '%Y-%m-%dT%H:%i'
            ) AS schedule
          FROM orders o
          WHERE o.order_id=?
          FOR UPDATE
        `,

        SERVICE: `
          SELECT
            s.status,
            s.customer_id AS customerId,
            (
              SELECT c.user_id
              FROM customers c
              WHERE c.customer_id=s.customer_id
            ) AS userId,
            DATE_FORMAT(
              s.preferred_start,
              '%Y-%m-%dT%H:%i'
            ) AS schedule
          FROM service_requests s
          WHERE s.service_request_id=?
          FOR UPDATE
        `,

        FB: `
          SELECT status,customer_id AS customerId
          FROM facebook_order_requests
          WHERE facebook_request_id=?
          FOR UPDATE
        `,
      };

      const [rows] = await db.execute(statements[kind], [recordId]);

      return rows[0] || null;
    },

    async otherPendingRequests(customerId, kind, recordId) {
      const [[row]] = await db.execute(
        `SELECT (
           (
             SELECT COUNT(*)
             FROM orders
             WHERE customer_id=?
               AND order_status='PENDING'
               AND NOT (?='ORDER' AND order_id=?)
           )
           +
           (
             SELECT COUNT(*)
             FROM service_requests
             WHERE customer_id=?
               AND status='PENDING'
               AND NOT (?='SERVICE' AND service_request_id=?)
           )
         ) AS total`,
        [customerId, kind, recordId, customerId, kind, recordId],
      );

      return Number(row.total);
    },

    async confirmBooking(kind, recordId) {
      await db.execute(
        `UPDATE booking_reservations
         SET expires_at=NULL
         WHERE source_kind=?
           AND source_id=?`,
        [kind, recordId],
      );
    },

    async saveBooking(kind, recordId, date, start, temporary = false) {
      await db.execute(
        `INSERT INTO booking_reservations
           (
             source_kind,
             source_id,
             booking_date,
             start_time,
             expires_at
           )
         VALUES (
           ?,?,?,?,
           IF(
             ?,
             LEAST(
               DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR),
               CONVERT_TZ(
                 TIMESTAMP(?,?),
                 '+08:00',
                 '+00:00'
               )
             ),
             NULL
           )
         )
         ON DUPLICATE KEY UPDATE
           booking_date=VALUES(booking_date),
           start_time=VALUES(start_time),
           expires_at=VALUES(expires_at)`,
        [kind, recordId, date, start, Number(temporary), date, start],
      );
    },

    async technicianWorkingElsewhere(technicianId, kind, sourceId) {
      const [rows] = await db.execute(
        `SELECT w.work_order_id
         FROM work_orders w
         JOIN technician_assignments a
           ON a.work_order_id=w.work_order_id
         WHERE a.technician_id=?
           AND a.status='IN_PROGRESS'
           AND w.status='IN_PROGRESS'
           AND NOT (
             (?='ORDER' AND w.order_id <=> ?)
             OR
             (?='SERVICE' AND w.service_request_id <=> ?)
           )
         LIMIT 1`,
        [technicianId, kind, sourceId, kind, sourceId],
      );

      return rows.length > 0;
    },

    async removeBooking(kind, recordId) {
      await db.execute(
        `DELETE FROM booking_reservations
         WHERE source_kind=?
           AND source_id=?`,
        [kind, recordId],
      );
    },

    async transferBooking(oldKind, oldId, newKind, newId) {
      const [result] = await db.execute(
        `UPDATE booking_reservations
         SET source_kind=?,source_id=?
         WHERE source_kind=?
           AND source_id=?`,
        [newKind, newId, oldKind, oldId],
      );

      return result.affectedRows;
    },

    async updateSlot(date, start, capacity, closed) {
      await db.execute(
        `UPDATE booking_slots
         SET capacity=?,is_closed=?
         WHERE schedule_date=?
           AND start_time=?`,
        [capacity, Number(closed), date, start],
      );
    },

    async syncSourceDate(kind, recordId, sqlDate) {
      if (kind === "ORDER") {
        await db.execute(
          `UPDATE orders
           SET preferred_schedule=?
           WHERE order_id=?`,
          [sqlDate, recordId],
        );
      } else if (kind === "SERVICE") {
        await db.execute(
          `UPDATE service_requests
           SET preferred_start=?
           WHERE service_request_id=?`,
          [sqlDate, recordId],
        );
      }
    },

    async dayBookings(date) {
      const [rows] = await db.execute(
        `SELECT
           r.source_kind AS kind,
           r.source_id AS recordId,
           TIME_FORMAT(r.start_time,'%H:%i') AS start,

           COALESCE(
             CONCAT(
               'AV-',
               YEAR(o.ordered_at),
               '-',
               CASE
                 WHEN o.order_id < 1000000
                 THEN LPAD(o.order_id,6,'0')
                 ELSE CAST(o.order_id AS CHAR)
               END
             ),
             CONCAT('Service #',sr.service_request_id),
             fb.request_number
           ) AS reference,

           COALESCE(
             o.recipient_name,
             uc.name,
             fb.customer_name,
             sr.walk_in_customer_name,
             'Customer'
           ) AS customer,

           COALESCE(
             o.order_status,
             sr.status,
             fb.status
           ) AS status,

           COALESCE(
             o.contact_number,
             sr.contact_number,
             fb.contact_number
           ) AS phone

         FROM booking_reservations r

         LEFT JOIN orders o
           ON r.source_kind='ORDER'
           AND o.order_id=r.source_id

         LEFT JOIN service_requests sr
           ON r.source_kind='SERVICE'
           AND sr.service_request_id=r.source_id

         LEFT JOIN customers c
           ON c.customer_id=sr.customer_id

         LEFT JOIN users uc
           ON uc.user_id=c.user_id

         LEFT JOIN facebook_order_requests fb
           ON r.source_kind='FB'
           AND fb.facebook_request_id=r.source_id

         WHERE r.booking_date=?
           AND (
             r.expires_at IS NULL
             OR r.expires_at > UTC_TIMESTAMP(3)
           )

         ORDER BY
           r.start_time,
           r.source_kind,
           r.source_id`,
        [date],
      );

      return rows;
    },
  };
}
