/** Additional safeguards for manual archive purging. */
export function permanentArchiveModel(db) {
  return {
    async hasArchivedVariants(productId) {
      const [rows] = await db.execute(
        `SELECT a.archive_id
         FROM management_archive a
         JOIN product_variants v
           ON a.record_id=v.variant_id
         WHERE a.module_name='variants'
           AND a.state='ARCHIVED'
           AND v.product_id=?
         LIMIT 1 FOR UPDATE`,
        [productId],
      );

      return rows.length > 0;
    },

    async removeEmptyInventory(module, id) {
      if (module === "variants") {
        await db.execute(
          `DELETE FROM inventory
           WHERE variant_id=?
             AND on_hand_quantity=0
             AND reserved_quantity=0`,
          [id],
        );
      } else if (module === "products") {
        await db.execute(
          `DELETE i FROM inventory i
           JOIN product_variants v
             ON v.variant_id=i.variant_id
           WHERE v.product_id=?
             AND i.on_hand_quantity=0
             AND i.reserved_quantity=0`,
          [id],
        );
      }
    },

    async hasServiceTypeReferences(id) {
      const [rows] = await db.execute(
        `SELECT facebook_request_id
         FROM facebook_order_requests
         WHERE service_type_id=?
         LIMIT 1 FOR UPDATE`,
        [id],
      );

      return rows.length > 0;
    },

    async hasFacebookReferences(id) {
      const [rows] = await db.execute(
        `SELECT 1 AS found
         WHERE
           EXISTS(
             SELECT 1 FROM service_requests
             WHERE facebook_request_id=?
           )
           OR EXISTS(
             SELECT 1 FROM work_orders
             WHERE facebook_request_id=?
           )
           OR EXISTS(
             SELECT 1 FROM booking_reservations
             WHERE source_kind='FB' AND source_id=?
           )`,
        [id, id, id],
      );

      return rows.length > 0;
    },
  };
}
