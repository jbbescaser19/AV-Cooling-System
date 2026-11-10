/** Dedicated referenceOptions database queries. */
export function referenceOptionsModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  return {
    async options() {
      const [
        categories,
        variants,
        serviceTypes,
        technicians,
        techUsers,
        orders,
        requests,
      ] = await Promise.all([
        select(
          `SELECT category_id AS id,category_name AS label FROM product_categories WHERE status='ACTIVE' ORDER BY category_name`,
        ),
        select(
          `SELECT v.variant_id AS id,CONCAT(p.brand,' ',p.model,' · ',v.horsepower,' HP') AS label FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE p.status='ACTIVE' AND v.status='ACTIVE' ORDER BY p.brand,p.model`,
        ),
        select(
          `SELECT service_type_id AS id,service_name AS label,service_code AS code FROM service_types WHERE status='ACTIVE' ORDER BY service_name`,
        ),
        select(
          `SELECT t.technician_id AS id,u.name AS label FROM technicians t JOIN users u ON u.user_id=t.user_id WHERE t.status='ACTIVE' AND u.status='ACTIVE' ORDER BY u.name`,
        ),
        select(
          `SELECT user_id AS id,name AS label FROM users WHERE account_type='STAFF' AND role='TECHNICIAN' AND status='ACTIVE' AND user_id NOT IN (SELECT user_id FROM technicians) ORDER BY name`,
        ),
        select(
          `SELECT order_id AS id,order_number AS label FROM orders WHERE order_status IN ('CONFIRMED','SCHEDULED','IN_PROGRESS') ORDER BY order_id DESC LIMIT 100`,
        ),
        select(
          `SELECT service_request_id AS id,CONCAT('Service #',service_request_id) AS label FROM service_requests WHERE status='CONFIRMED' ORDER BY service_request_id DESC LIMIT 100`,
        ),
      ]);
      return {
        categories,
        variants,
        serviceTypes,
        technicians,
        techUsers,
        orders,
        requests,
      };
    },
  };
}
