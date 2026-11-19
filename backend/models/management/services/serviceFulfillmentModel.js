/** SQL for service request management. */
export function serviceRequestModel(db) {
  return {
    async listServices() {
      const [rows] = await db.execute(`
        SELECT
          sr.service_request_id AS id,
          sr.service_request_id AS reference,

          CONCAT(
            'AV-S-',YEAR(sr.created_at),'-',
            CASE WHEN sr.service_request_id<1000000
              THEN LPAD(sr.service_request_id,6,'0')
              ELSE CAST(sr.service_request_id AS CHAR)
            END
          ) AS displayReference,

          sr.facebook_request_id AS facebookRequestId,
          sr.status,

          CASE
            WHEN rf.refund_id IS NOT NULL THEN 'REFUNDED'
            ELSE COALESCE(sp.status,'NO_RECORD')
          END AS paymentStatus,

          sp.method_code AS paymentMethod,
          CAST(sp.amount AS DOUBLE) AS paymentAmount,

          COALESCE(
            u.name,
            sr.walk_in_customer_name,
            fb.customer_name,
            'Service customer'
          ) AS customer,

          sr.contact_number AS contact,
          sr.service_address AS address,
          sr.destination_address AS destinationAddress,
          sr.customer_concern AS concern,
          sr.customer_notes AS customerNotes,

          CONCAT_WS(
            ' · ',
            st.service_name,
            NULLIF(
              TRIM(CONCAT_WS(' ',sr.aircon_brand,sr.aircon_model)),
              ''
            ),
            CASE
              WHEN sr.aircon_horsepower IS NOT NULL
              THEN CONCAT(sr.aircon_horsepower,' HP')
            END,
            CASE
              WHEN sr.aircon_brand IS NOT NULL
                OR sr.aircon_model IS NOT NULL
                OR sr.aircon_horsepower IS NOT NULL
              THEN CASE
                WHEN sr.aircon_source='PURCHASED'
                THEN '(AV Cooling purchase)'
                ELSE '(Customer-owned)'
              END
            END
          ) AS products,

          DATE_FORMAT(
            sr.preferred_start,
            '%Y-%m-%dT%H:%i'
          ) AS schedule,

          sr.created_at AS createdAt,

          CAST(sr.service_price AS DOUBLE) AS total,

          CAST(
            sr.service_price +
            sr.discount_amount -
            sr.additional_fee_amount AS DOUBLE
          ) AS subtotal,

          CAST(sr.discount_amount AS DOUBLE) AS discount,
          CAST(sr.additional_fee_amount AS DOUBLE) AS additionalFee,
          sr.additional_fee_reason AS additionalFeeReason,

          (sr.pos_request_key IS NOT NULL) AS isPosWalkIn,

          EXISTS (
            SELECT 1
            FROM work_orders w
            JOIN technician_assignments a
              ON a.work_order_id=w.work_order_id
            WHERE w.service_request_id=sr.service_request_id
              AND w.work_type='SERVICE'
              AND w.status IN ('ASSIGNED','IN_PROGRESS')
              AND a.status IN ('ASSIGNED','IN_PROGRESS')
          ) AS hasAssignedServiceWork,

          (
            (
              sr.pos_request_key IS NOT NULL
              AND sr.preferred_start IS NOT NULL
              AND sr.status IN ('CONFIRMED','COMPLETED')
            )
            OR EXISTS (
              SELECT 1
              FROM fulfillment_events fe
              WHERE fe.event_kind='SERVICE'
                AND fe.record_id=sr.service_request_id
                AND fe.event_code IN (
                  'SERVICE_SCHEDULED','SERVICE_ACCEPTED'
                )
            )
          ) AS serviceScheduled,

          EXISTS (
            SELECT 1
            FROM fulfillment_events fe
            WHERE fe.event_kind='SERVICE'
              AND fe.record_id=sr.service_request_id
              AND fe.event_code='SERVICE_STARTED'
          ) AS serviceStarted

        FROM service_requests sr

        LEFT JOIN customers c
          ON c.customer_id=sr.customer_id

        LEFT JOIN users u
          ON u.user_id=c.user_id

        LEFT JOIN facebook_order_requests fb
          ON fb.facebook_request_id=sr.facebook_request_id

        JOIN service_types st
          ON st.service_type_id=sr.service_type_id

        LEFT JOIN service_payments sp
          ON sp.service_payment_id=(
            SELECT MAX(p2.service_payment_id)
            FROM service_payments p2
            WHERE p2.service_request_id=sr.service_request_id
          )

        LEFT JOIN service_payment_refunds rf
          ON rf.service_payment_id=sp.service_payment_id

        ORDER BY sr.service_request_id DESC
        LIMIT 100
      `);

      return rows;
    },

    async lockService(requestId) {
      const [rows] = await db.execute(
        `SELECT
           sr.service_request_id AS id,
           sr.status,
           c.user_id AS userId,

           (sr.facebook_request_id IS NOT NULL) AS isFacebook,

           EXISTS (
             SELECT 1
             FROM service_payments sp
             WHERE sp.service_request_id=sr.service_request_id
               AND sp.status='PAID'
               AND NOT EXISTS (
                 SELECT 1
                 FROM service_payment_refunds rf
                 WHERE rf.service_payment_id=sp.service_payment_id
               )
           ) AS hasVerifiedPayment,

           (sr.pos_request_key IS NOT NULL) AS isPosWalkIn,

           EXISTS (
             SELECT 1
             FROM work_orders w
             WHERE w.service_request_id=sr.service_request_id
               AND w.work_type='SERVICE'
               AND w.status IN ('ASSIGNED','IN_PROGRESS')
           ) AS hasAssignedServiceWork,

           DATE_FORMAT(
             sr.preferred_start,
             '%Y-%m-%dT%H:%i'
           ) AS schedule

         FROM service_requests sr

         LEFT JOIN customers c
           ON c.customer_id=sr.customer_id

         WHERE sr.service_request_id=?
         LIMIT 1 FOR UPDATE`,
        [requestId],
      );

      return rows[0] || null;
    },

    async setServiceStatus(requestId, status, schedule) {
      await db.execute(
        `UPDATE service_requests
         SET status=?,
             preferred_start=COALESCE(?,preferred_start)
         WHERE service_request_id=?`,
        [status, schedule, requestId],
      );
    },
  };
}
