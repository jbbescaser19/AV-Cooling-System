/** Dedicated serviceRequest database queries. */
export function serviceRequestModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    findServiceRequest(id) {
      return select(
        `SELECT service_request_id AS id,c.status AS customerStatus,u.name AS customer,s.contact_number AS phone,s.service_address AS address,s.status FROM service_requests s LEFT JOIN customers c ON c.customer_id=s.customer_id LEFT JOIN users u ON u.user_id=c.user_id WHERE s.service_request_id=? LIMIT 1 FOR UPDATE`,
        [id],
      );
    },
    facebookServiceComplete(id) {
      return execute(
        `UPDATE service_requests SET status='COMPLETED' WHERE service_request_id=? AND facebook_request_id IS NOT NULL AND status='CONFIRMED'`,
        [id],
      );
    },
    fbCreateServiceRequest(fb, serviceType) {
      // Service details come from this staff-confirmed Facebook agreement.
      const hasAircon = Boolean(
        fb.aircon_brand && fb.aircon_model && fb.aircon_horsepower,
      );
      return execute(
        `INSERT INTO service_requests(customer_id,service_type_id,service_price,customer_concern,customer_notes,preferred_start,contact_number,service_address,status,facebook_request_id,aircon_source,aircon_brand,aircon_model,aircon_horsepower) VALUES (NULL,?,?,?,?,?,?,?,'CONFIRMED',?,?,?,?,?)`,
        [
          fb.service_type_id,
          serviceType.base_price,
          fb.customer_notes,
          "Manual Facebook Messenger agreement",
          fb.preferred_schedule.replace("T", " "),
          fb.contact_number,
          fb.delivery_address,
          fb.facebook_request_id,
          hasAircon ? "CUSTOMER_OWNED" : null,
          hasAircon ? fb.aircon_brand : null,
          hasAircon ? fb.aircon_model : null,
          hasAircon ? fb.aircon_horsepower : null,
        ],
      );
    },
  };
}
