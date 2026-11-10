/** Dedicated serviceType database queries. */
export function serviceTypeModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listServiceTypes(staffId) {
      return select(
        `SELECT service_type_id AS id,service_name AS name,service_code AS code,description,base_price AS price,status FROM service_types ORDER BY service_type_id DESC LIMIT 200`,
      );
    },
    createServiceType(data) {
      return execute(
        `INSERT INTO service_types(service_name,service_code,description,base_price,status) VALUES (?,?,?,?,'ACTIVE')`,
        [data.name, data.code, data.description, data.price],
      );
    },
    updateServiceType(id, data) {
      return execute(
        `UPDATE service_types SET service_name=?,service_code=?,description=?,base_price=?,status=? WHERE service_type_id=?`,
        [data.name, data.code, data.description, data.price, data.status, id],
      );
    },
    getServiceType(id) {
      return select(
        `SELECT service_type_id,service_code,service_name,base_price,status FROM service_types WHERE service_type_id=? LIMIT 1`,
        [id],
      );
    },
  };
}
