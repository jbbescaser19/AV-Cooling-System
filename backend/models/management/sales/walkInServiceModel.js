/** All SQL for walk-in service bookings from POS. */
export function walkInServiceModel(db) {
  return {
    async byRequestKey(key) {
      const [[row]] = await db.execute(
        `SELECT s.service_request_id AS id,
        st.service_name AS service, s.walk_in_customer_name AS customer,
        s.service_address AS pickupAddress, s.destination_address AS destinationAddress,
        DATE_FORMAT(s.preferred_start,'%Y-%m-%dT%H:%i') AS scheduledStart,
        CAST(s.service_price AS DOUBLE) AS price,
        CAST(s.additional_fee_amount AS DOUBLE) AS additionalFee,
        s.additional_fee_reason AS additionalFeeReason,
        COALESCE(sp.status,'NOT_RECORDED') AS paymentStatus
        FROM service_requests s JOIN service_types st ON st.service_type_id=s.service_type_id
        LEFT JOIN service_payments sp ON sp.service_request_id=s.service_request_id
        WHERE s.pos_request_key=? LIMIT 1`,
        [key],
      );
      return row || null;
    },
    async activeServices() {
      const [rows] =
        await db.execute(`SELECT service_type_id AS id,service_name AS name,
        service_code AS code, CAST(base_price AS DOUBLE) AS price
        FROM service_types WHERE status='ACTIVE' ORDER BY service_name`);
      return rows;
    },
    async lockServiceType(id) {
      const [[row]] = await db.execute(
        `SELECT service_type_id AS id,
        service_name AS name, service_code AS code, base_price AS price
        FROM service_types WHERE service_type_id=? AND status='ACTIVE' LIMIT 1 FOR UPDATE`,
        [id],
      );
      return row || null;
    },
    async createWalkIn(data, price) {
      const [result] = await db.execute(
        `INSERT INTO service_requests
        (customer_id,service_type_id,service_price,additional_fee_amount,additional_fee_reason,customer_concern,customer_notes,
         preferred_start,contact_number,service_address,destination_address,status,aircon_source,
         aircon_brand,aircon_model,aircon_horsepower,walk_in_customer_name,pos_request_key,
         copper_pipe_feet,includes_dismantling)
        VALUES(NULL,?,?,?,?,?,?,?,?,?,?,'CONFIRMED','CUSTOMER_OWNED',?,?,?,?,?,?,?)`,
        [
          data.serviceTypeId,
          price,
          data.additionalFee,
          data.additionalFeeReason || null,
          data.concern || null,
          "Walk-in service booked at POS; no cash payment recorded",
          `${data.scheduledStart.replace("T", " ")}:00`,
          data.customerPhone,
          data.serviceAddress,
          data.destinationAddress || null,
          data.airconBrand || null,
          data.airconModel || null,
          data.airconHorsepower || null,
          data.customerName,
          data.requestKey,
          data.copperFeet,
          data.includeDismantling ? 1 : 0,
        ],
      );
      return result.insertId;
    },
  };
}
