/** All SQL for walk-in service bookings from POS. */
export function walkInServiceModel(db) {
  return {
    async byRequestKey(key) {
      const [[row]] = await db.execute(
        `SELECT s.service_request_id AS id,
        st.service_name AS service, s.walk_in_customer_name AS customer,
        DATE_FORMAT(s.preferred_start,'%Y-%m-%dT%H:%i') AS scheduledStart,
        CAST(s.service_price AS DOUBLE) AS price
        FROM service_requests s JOIN service_types st ON st.service_type_id=s.service_type_id
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
        service_name AS name, base_price AS price
        FROM service_types WHERE service_type_id=? AND status='ACTIVE' LIMIT 1 FOR UPDATE`,
        [id],
      );
      return row || null;
    },
    async createWalkIn(data, price) {
      const [result] = await db.execute(
        `INSERT INTO service_requests
        (customer_id,service_type_id,service_price,customer_concern,customer_notes,
         preferred_start,contact_number,service_address,status,aircon_source,
         aircon_brand,aircon_model,aircon_horsepower,walk_in_customer_name,pos_request_key)
        VALUES(NULL,?,?,?,?,?,?,?,'CONFIRMED','CUSTOMER_OWNED',?,?,?,?,?)`,
        [
          data.serviceTypeId,
          price,
          data.concern || null,
          "Walk-in service booked at POS; no cash payment recorded",
          `${data.scheduledStart.replace("T", " ")}:00`,
          data.customerPhone,
          data.serviceAddress,
          data.airconBrand || null,
          data.airconModel || null,
          data.airconHorsepower || null,
          data.customerName,
          data.requestKey,
        ],
      );
      return result.insertId;
    },
  };
}
