const fields = `
  sr.service_request_id AS requestId,
  st.service_code AS serviceType,
  st.service_name AS serviceName,
  sr.service_price AS estimatedBasePrice,
  DATE_FORMAT(
    sr.preferred_start,
    '%Y-%m-%d %H:%i:%s'
  ) AS preferredStart,
  sr.contact_number AS contactNumber,
  sr.service_address AS serviceAddress,
  sr.destination_address AS destinationAddress,
  sr.customer_concern AS concern,
  sr.customer_notes AS notes,
  sr.aircon_source AS airconSource,
  sr.aircon_brand AS airconBrand,
  sr.aircon_model AS airconModel,
  CAST(sr.aircon_horsepower AS DOUBLE) AS airconHorsepower,
  sr.status,
  sr.customer_revision AS revision,
  DATE_FORMAT(
    sr.created_at,
    '%Y-%m-%d %H:%i:%s'
  ) AS createdAt,
  EXISTS(
    SELECT 1
    FROM work_orders AS wo
    WHERE wo.service_request_id = sr.service_request_id
      AND wo.status <> 'CANCELLED'
  ) AS hasWorkOrder
`;

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
        `SELECT ${fields}
         FROM service_requests AS sr
         INNER JOIN service_types AS st
           ON st.service_type_id = sr.service_type_id
         WHERE sr.customer_id = ?
           AND sr.customer_deleted_at IS NULL
         ORDER BY
           sr.created_at DESC,
           sr.service_request_id DESC
         LIMIT 100`,
        [customerId],
      );
    },

    lockRequest(customerId, requestId) {
      return db.execute(
        `SELECT
           sr.service_request_id AS requestId,
           sr.status,
           sr.customer_revision AS revision,
           st.service_code AS serviceType
         FROM service_requests AS sr
         INNER JOIN service_types AS st
           ON st.service_type_id = sr.service_type_id
         WHERE sr.customer_id = ?
           AND sr.service_request_id = ?
           AND sr.customer_deleted_at IS NULL
         FOR UPDATE`,
        [customerId, requestId],
      );
    },

    lockWorkOrders(requestId) {
      return db.execute(
        `SELECT work_order_id
         FROM work_orders
         WHERE service_request_id = ?
           AND status <> 'CANCELLED'
         FOR UPDATE`,
        [requestId],
      );
    },

    updateRequest(customerId, requestId, data) {
      return db.execute(
        `UPDATE service_requests
         SET
           preferred_start = ?,
           contact_number = ?,
           service_address = ?,
           destination_address = ?,
           customer_concern = ?,
           customer_notes = ?,
           customer_revision = customer_revision + 1
         WHERE customer_id = ?
           AND service_request_id = ?`,
        [
          data.preferredStart,
          data.contactNumber,
          data.serviceAddress,
          data.destinationAddress,
          data.concern || null,
          data.notes || null,
          customerId,
          requestId,
        ],
      );
    },

    cancelRequest(customerId, requestId) {
      return db.execute(
        `UPDATE service_requests
         SET
           status = 'CANCELLED',
           customer_revision = customer_revision + 1
         WHERE customer_id = ?
           AND service_request_id = ?`,
        [customerId, requestId],
      );
    },

    hideRequest(customerId, requestId) {
      return db.execute(
        `UPDATE service_requests
         SET
           customer_deleted_at = CURRENT_TIMESTAMP,
           customer_revision = customer_revision + 1
         WHERE customer_id = ?
           AND service_request_id = ?`,
        [customerId, requestId],
      );
    },
  };
}
