export function customerServiceModel(db) {
  return {
    findCustomerByUserId(userId) {
      return db.execute(
        `SELECT
           c.customer_id AS customerId,
           c.status AS customerStatus,
           u.status AS userStatus
         FROM customers AS c
         INNER JOIN users AS u
           ON u.user_id = c.user_id
         WHERE u.user_id = ?
           AND u.account_type = 'CUSTOMER'
         LIMIT 1`,
        [userId],
      );
    },

    findMyServicesByCustomerId(customerId) {
      return db.execute(
        `SELECT
           sr.service_request_id AS requestId,
           st.service_code AS serviceType,
           st.service_name AS serviceName,
           sr.service_price AS estimatedBasePrice,
           DATE_FORMAT(sr.preferred_start, '%Y-%m-%d %H:%i:%s') AS preferredStart,
           sr.service_address AS serviceAddress,
           sr.destination_address AS destinationAddress,
           sr.customer_concern AS concern,
           sr.customer_notes AS notes,
           sr.status AS status,
           DATE_FORMAT(sr.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
         FROM service_requests AS sr
         INNER JOIN service_types AS st
           ON st.service_type_id = sr.service_type_id
         WHERE sr.customer_id = ?
         ORDER BY sr.created_at DESC, sr.service_request_id DESC
         LIMIT 100`,
        [customerId],
      );
    },
  };
}
