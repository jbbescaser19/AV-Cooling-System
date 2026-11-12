/** SQL for the serviceRequest management feature. */
export function serviceRequestModel(db) {
  return {
    async listServices() {
      const [rows] = await db.execute(`SELECT
               sr.service_request_id AS id,
               sr.service_request_id AS reference,
               sr.facebook_request_id AS facebookRequestId,
               sr.status,
               COALESCE(sp.status, 'NO_RECORD') AS paymentStatus,
               sp.method_code AS paymentMethod,
               CAST(sp.amount AS DOUBLE) AS paymentAmount,
               COALESCE(u.name,sr.walk_in_customer_name,fb.customer_name,'Service customer') AS customer,
               sr.contact_number AS contact,
               sr.service_address AS address,
               sr.destination_address AS destinationAddress,
               sr.customer_concern AS concern,
               sr.customer_notes AS customerNotes,
               CASE
                 WHEN sr.aircon_brand IS NOT NULL
                 THEN CONCAT(
                   st.service_name, ' · ', sr.aircon_brand, ' ',
                   sr.aircon_model, ' · ',
                   CAST(sr.aircon_horsepower AS CHAR), ' HP',
                   CASE WHEN sr.aircon_source = 'PURCHASED'
                     THEN ' (AV Cooling purchase)'
                     ELSE ' (Customer-owned)' END
                 )
                 ELSE st.service_name
               END AS products,
    
               DATE_FORMAT(
                 sr.preferred_start,
                 '%Y-%m-%dT%H:%i'
               ) AS schedule,
    
               sr.created_at AS createdAt,
               CAST(sr.service_price AS DOUBLE) AS total,
               CAST(sr.additional_fee_amount AS DOUBLE) AS additionalFee,
               sr.additional_fee_reason AS additionalFeeReason,
    
               EXISTS (
                 SELECT 1
                 FROM fulfillment_events fe
                 WHERE fe.event_kind = 'SERVICE'
                   AND fe.record_id = sr.service_request_id
                   AND fe.event_code = 'SERVICE_SCHEDULED'
               ) AS serviceScheduled,
    
               EXISTS (
                 SELECT 1
                 FROM fulfillment_events fe
                 WHERE fe.event_kind = 'SERVICE'
                   AND fe.record_id = sr.service_request_id
                   AND fe.event_code = 'SERVICE_STARTED'
               ) AS serviceStarted
    
             FROM service_requests sr
             LEFT JOIN customers c
               ON c.customer_id = sr.customer_id
             LEFT JOIN users u
               ON u.user_id = c.user_id
             LEFT JOIN facebook_order_requests fb ON fb.facebook_request_id=sr.facebook_request_id
             JOIN service_types st
               ON st.service_type_id = sr.service_type_id
             LEFT JOIN service_payments sp ON sp.service_payment_id = (
               SELECT MAX(p2.service_payment_id)
               FROM service_payments p2
               WHERE p2.service_request_id = sr.service_request_id
             )
    
             ORDER BY sr.service_request_id DESC
             LIMIT 100`);
      return rows;
    },
    async lockService(requestId) {
      const [rows] = await db.execute(
        `SELECT
               sr.service_request_id AS id,
               sr.status,
               c.user_id AS userId,
    
               DATE_FORMAT(
                 sr.preferred_start,
                 '%Y-%m-%dT%H:%i'
               ) AS schedule
    
             FROM service_requests sr
             LEFT JOIN customers c
               ON c.customer_id = sr.customer_id
    
             WHERE sr.service_request_id = ?
    
             LIMIT 1
             FOR UPDATE`,
        [requestId],
      );
      return rows[0] || null;
    },
    async setServiceStatus(requestId, status, schedule) {
      await db.execute(
        `UPDATE service_requests
             SET
               status = ?,
               preferred_start =
                 COALESCE(?, preferred_start)
             WHERE service_request_id = ?`,
        [status, schedule, requestId],
      );
    },
  };
}
