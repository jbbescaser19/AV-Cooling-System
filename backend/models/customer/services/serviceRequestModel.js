export function serviceRequestModel(db) {
  return {
    findCustomerByUserId(userId, lock = false) {
      return db.execute(
        `SELECT
           c.customer_id AS customerId,
           c.phone AS contactNumber,
           c.status AS customerStatus,
           u.status AS userStatus
         FROM customers AS c
         INNER JOIN users AS u
           ON u.user_id = c.user_id
         WHERE u.user_id = ?
           AND u.account_type = 'CUSTOMER'
         LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [userId],
      );
    },

    findActiveServices() {
      return db.execute(
        `SELECT
           service_type_id AS serviceTypeId,
           service_code AS serviceType,
           service_name AS serviceName,
           base_price AS basePrice
         FROM service_types
         WHERE status = 'ACTIVE'
           AND service_code IS NOT NULL
         ORDER BY service_name`,
      );
    },

    findActiveServiceByCode(serviceType) {
      return db.execute(
        `SELECT
           service_type_id AS serviceTypeId,
           service_code AS serviceType,
           service_name AS serviceName,
           base_price AS basePrice
         FROM service_types
         WHERE service_code = ?
           AND status = 'ACTIVE'
         LIMIT 1`,
        [serviceType],
      );
    },

    createRequest(request) {
      return db.execute(
        `INSERT INTO service_requests (
           customer_id,
           service_type_id,
           service_price,
           preferred_start,
           contact_number,
           service_address,
           destination_address,
           customer_concern,
           customer_notes,
           aircon_source,
           aircon_order_item_id,
           aircon_brand,
           aircon_model,
           aircon_horsepower,
           copper_pipe_feet,
           includes_dismantling,
           status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          request.customerId,
          request.serviceTypeId,
          request.servicePrice,
          request.preferredStart,
          request.contactNumber,
          request.serviceAddress,
          request.destinationAddress,
          request.concern,
          request.notes,
          request.aircon?.source ?? null,
          request.aircon?.orderItemId ?? null,
          request.aircon?.brand ?? null,
          request.aircon?.model ?? null,
          request.aircon?.horsepower ?? null,
          request.copperFeet,
          request.includeDismantling ? 1 : 0,
        ],
      );
    },

    findRequestsByCustomerId(customerId) {
      return db.execute(
        `SELECT
           sr.service_request_id AS requestId,
           st.service_code AS serviceType,
           st.service_name AS serviceName,
           sr.service_price AS estimatedBasePrice,
           DATE_FORMAT(
             sr.preferred_start,
             '%Y-%m-%d %H:%i:%s'
           ) AS preferredStart,
           sr.service_address AS serviceAddress,
           sr.destination_address AS destinationAddress,
           sr.customer_concern AS concern,
           sr.customer_notes AS notes,
           sr.aircon_source AS airconSource,
           sr.aircon_brand AS airconBrand,
           sr.aircon_model AS airconModel,
           sr.aircon_horsepower AS airconHorsepower,
           sr.copper_pipe_feet AS copperFeet,
           sr.includes_dismantling AS includesDismantling,
           sr.status
         FROM service_requests AS sr
         INNER JOIN service_types AS st
           ON st.service_type_id = sr.service_type_id
         WHERE sr.customer_id = ?
           AND sr.customer_deleted_at IS NULL
         ORDER BY sr.service_request_id DESC
         LIMIT 100`,
        [customerId],
      );
    },
  };
}
