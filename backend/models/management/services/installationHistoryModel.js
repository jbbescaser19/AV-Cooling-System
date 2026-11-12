/** Completed job history. All history SQL remains in this dedicated model. */
const historySql = `
  SELECT w.work_order_id AS id,
         COALESCE(o.order_number, CONCAT('Service #', sr.service_request_id)) AS reference,
         IF(w.order_id IS NOT NULL, 'PRODUCT ORDER', 'SERVICE REQUEST') AS source,
         CASE WHEN w.work_type = 'INSTALLATION' OR st.service_code = 'installation'
              THEN 'INSTALLATION' ELSE 'SERVICE' END AS category,
         w.recipient_name AS customer, w.contact_number AS contactNumber,
         w.service_address AS address,
         DATE_FORMAT(w.scheduled_start, '%Y-%m-%d %H:%i') AS scheduledAt,
         COALESCE((SELECT MAX(h.changed_at) FROM work_order_status_history h
                   WHERE h.work_order_id = w.work_order_id AND h.new_status = 'COMPLETED'),
                  w.updated_at) AS completedAt,
         w.completion_notes AS summary,
         COALESCE(sp.method_code, pm.name, 'Not recorded') AS paymentMethod,
         COALESCE(sp.status, o.payment_status, 'NOT RECORDED') AS paymentStatus,
         COALESCE(CAST(o.total_amount AS CHAR), CAST(sp.amount AS CHAR),
                  CAST(sr.service_price AS CHAR), '0.00') AS amount,
         COALESCE((SELECT GROUP_CONCAT(CONCAT(oi.product_name_snapshot, ' · ',
                          oi.model_snapshot, ' · ', CAST(pv.horsepower AS CHAR), ' HP')
                          SEPARATOR '; ')
                   FROM order_items oi
                   LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
                   WHERE oi.order_id = w.order_id AND oi.installation_included = 1),
                  CONCAT(COALESCE(sr.aircon_brand, 'Aircon'), ' · ',
                         COALESCE(sr.aircon_model, 'Model not recorded'), ' · ',
                         COALESCE(CAST(sr.aircon_horsepower AS CHAR), '?'), ' HP')) AS aircon,
         (SELECT GROUP_CONCAT(u.name ORDER BY a.assignment_id SEPARATOR ', ')
          FROM technician_assignments a
          JOIN technicians t ON t.technician_id = a.technician_id
          JOIN users u ON u.user_id = t.user_id
          WHERE a.work_order_id = w.work_order_id AND a.status <> 'CANCELLED') AS team
  FROM work_orders w
  LEFT JOIN orders o ON o.order_id = w.order_id
  LEFT JOIN payment_methods pm ON pm.payment_method_id = o.payment_method_id
  LEFT JOIN service_requests sr ON sr.service_request_id = w.service_request_id
  LEFT JOIN service_types st ON st.service_type_id = sr.service_type_id
  LEFT JOIN service_payments sp ON sp.service_request_id = sr.service_request_id
  WHERE w.status = 'COMPLETED' AND w.work_type IN ('INSTALLATION', 'SERVICE')
`;

function filtersSql(filters) {
  const conditions = [];
  const params = [];
  if (filters.category !== "ALL") {
    conditions.push("h.category = ?");
    params.push(filters.category);
  }
  if (filters.startDate) {
    conditions.push("h.completedAt >= ?");
    params.push(filters.startDate);
  }
  if (filters.endExclusiveDate) {
    conditions.push("h.completedAt < ?");
    params.push(filters.endExclusiveDate);
  }
  if (filters.search) {
    const escaped = filters.search.replace(/[!%_]/g, (char) => `!${char}`);
    const pattern = `%${escaped}%`;
    const columns = [
      "h.reference",
      "h.customer",
      "h.aircon",
      "h.team",
      "h.source",
    ];
    conditions.push(
      `(${columns.map((column) => `COALESCE(${column}, '') LIKE ? ESCAPE '!'`).join(" OR ")})`,
    );
    params.push(...columns.map(() => pattern));
  }
  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function installationHistoryModel(db) {
  return {
    async completedInstallations(filters) {
      const { clause, params } = filtersSql(filters);
      const base = `(${historySql}) h`;
      const [counts] = await db.execute(
        `SELECT h.category, COUNT(*) AS total FROM ${base} ${clause} GROUP BY h.category`,
        params,
      );
      const totals = { INSTALLATION: 0, SERVICE: 0 };
      for (const row of counts) {
        if (Object.hasOwn(totals, row.category))
          totals[row.category] = Number(row.total);
      }
      const total = totals.INSTALLATION + totals.SERVICE;
      const offset = (filters.page - 1) * filters.pageSize;
      const [rows] = await db.execute(
        `SELECT h.* FROM ${base} ${clause}
         ORDER BY h.completedAt DESC, h.id DESC LIMIT ? OFFSET ?`,
        [...params, filters.pageSize, offset],
      );
      return {
        installations: rows,
        counts: totals,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      };
    },
  };
}
