/** All archive SQL, including guarded catalog retirement and FK-safe cleanup. */
const CATALOG = Object.freeze({
  products: { table: "products", id: "product_id", label: "product_name" },
  categories: {
    table: "product_categories",
    id: "category_id",
    label: "category_name",
  },
  variants: {
    table: "product_variants",
    id: "variant_id",
    label: "horsepower",
  },
  "service-types": {
    table: "service_types",
    id: "service_type_id",
    label: "service_name",
  },
  technicians: {
    table: "technicians",
    id: "technician_id",
    label: "technician_code",
  },
  "facebook-requests": {
    table: "facebook_order_requests",
    id: "facebook_request_id",
    label: "customer_name",
  },
});
export const archivableModules = Object.freeze(Object.keys(CATALOG));
export function archiveModel(db) {
  return {
    async activeIds(module) {
      const [rows] = await db.execute(
        `SELECT record_id FROM management_archive WHERE module_name=? AND state='ARCHIVED'`,
        [module],
      );
      return rows.map((r) => Number(r.record_id));
    },
    async isArchived(module, id) {
      const [[row]] = await db.execute(
        `SELECT archive_id FROM management_archive WHERE module_name=? AND record_id=? AND state='ARCHIVED' LIMIT 1`,
        [module, id],
      );
      return Boolean(row);
    },
    async lockCatalogRecord(module, id) {
      const table = CATALOG[module];
      if (!table) return null;
      const [[row]] = await db.execute(
        `SELECT * FROM ${table.table} WHERE ${table.id}=? LIMIT 1 FOR UPDATE`,
        [id],
      );
      return row || null;
    },
    async hasInventory(module, id) {
      if (!["products", "variants"].includes(module)) return false;
      const sql =
        module === "products"
          ? `SELECT COUNT(*) AS total FROM inventory i JOIN product_variants v ON v.variant_id=i.variant_id
           WHERE v.product_id=? AND (i.on_hand_quantity>0 OR i.reserved_quantity>0)`
          : `SELECT COUNT(*) AS total FROM inventory
           WHERE variant_id=? AND (on_hand_quantity>0 OR reserved_quantity>0)`;
      const [[row]] = await db.execute(sql, [id]);
      return Number(row.total) > 0;
    },
    async categoryHasActiveProducts(id) {
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS total FROM products WHERE category_id=? AND status='ACTIVE'`,
        [id],
      );
      return Number(row.total) > 0;
    },
    async technicianAccountStillActive(id) {
      const [[row]] = await db.execute(
        `SELECT u.status AS userStatus FROM technicians t JOIN users u ON u.user_id=t.user_id
         WHERE t.technician_id=? LIMIT 1`,
        [id],
      );
      return row?.userStatus === "ACTIVE";
    },
    async technicianHasActiveWork(id) {
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS total FROM technician_assignments a
         JOIN work_orders w ON w.work_order_id=a.work_order_id
         WHERE a.technician_id=? AND w.status IN ('PENDING','ASSIGNED','IN_PROGRESS')
         AND a.status IN ('ASSIGNED','IN_PROGRESS')`,
        [id],
      );
      return Number(row.total) > 0;
    },
    async setCatalogStatus(module, id, status) {
      const table = CATALOG[module];
      if (!table) throw new Error("Unsupported archive category");
      const [result] = await db.execute(
        `UPDATE ${table.table} SET status=? WHERE ${table.id}=?`,
        [status, id],
      );
      return result.affectedRows;
    },
    async add({
      archiveId,
      module,
      origin,
      id,
      label,
      snapshot,
      previousStatus,
      staffId,
    }) {
      await db.execute(
        `INSERT INTO management_archive
         (archive_id,module_name,source_module,record_id,record_label,record_snapshot,previous_status,archived_by,purge_after)
         VALUES (?,?,?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL 3 YEAR))`,
        [
          archiveId,
          module,
          origin,
          id,
          label,
          JSON.stringify(snapshot),
          previousStatus,
          staffId,
        ],
      );
    },
    async list(includeDeletedAccounts = false) {
      const [rows] = await db.execute(
        `SELECT a.archive_id AS id,a.module_name AS category,a.source_module AS sourceModule,a.record_id AS recordId,
          a.record_label AS label,a.record_snapshot AS snapshot,a.previous_status AS previousStatus,
          a.archived_at AS deletedAt,a.purge_after AS purgeAfter,
          u.name AS deletedBy
         FROM management_archive a LEFT JOIN users u ON u.user_id=a.archived_by
         WHERE a.state='ARCHIVED'
           AND (?=1 OR a.module_name NOT IN ('customer-accounts','staff-accounts'))
         ORDER BY a.archived_at DESC LIMIT 500`,
        [includeDeletedAccounts ? 1 : 0],
      );
      return rows.map((row) => ({
        ...row,
        snapshot:
          typeof row.snapshot === "string"
            ? JSON.parse(row.snapshot)
            : row.snapshot,
      }));
    },
    async lockEntry(id) {
      const [[row]] = await db.execute(
        `SELECT archive_id AS id,module_name AS category,record_id AS recordId,
          record_label AS label,previous_status AS previousStatus
         FROM management_archive WHERE archive_id=? AND state='ARCHIVED' FOR UPDATE`,
        [id],
      );
      return row || null;
    },
    async restoreEntry(id) {
      const [result] = await db.execute(
        `UPDATE management_archive SET state='RESTORED',resolved_at=NOW()
         WHERE archive_id=? AND state='ARCHIVED'`,
        [id],
      );
      return result.affectedRows;
    },
    async expirationCandidates() {
      const [rows] = await db.execute(
        `SELECT archive_id AS id,module_name AS category,record_id AS recordId
         FROM management_archive WHERE state='ARCHIVED' AND purge_after <= NOW()
           AND (purge_retry_after IS NULL OR purge_retry_after <= NOW())
         ORDER BY purge_after ASC LIMIT 50`,
      );
      return rows;
    },
    async hardDeleteCatalog(module, id) {
      const table = CATALOG[module];
      if (!table) throw new Error("Unsupported purge category");
      // Foreign keys prevent deletion where purchases, payments, work or stock history needs the record.
      const [result] = await db.execute(
        `DELETE FROM ${table.table} WHERE ${table.id}=? AND status='${module === "facebook-requests" ? "CANCELLED" : "INACTIVE"}'`,
        [id],
      );
      return result.affectedRows;
    },
    async deferPurge(id) {
      await db.execute(
        `UPDATE management_archive SET purge_retry_after=DATE_ADD(NOW(), INTERVAL 30 DAY)
         WHERE archive_id=? AND state='ARCHIVED'`,
        [id],
      );
    },
    async markPurged(id) {
      await db.execute(
        `UPDATE management_archive SET state='PURGED',resolved_at=NOW(),
           record_snapshot=JSON_OBJECT() WHERE archive_id=? AND state='ARCHIVED'`,
        [id],
      );
    },
  };
}
