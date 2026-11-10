/** Dedicated variant database queries. */
export function variantModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listVariants(staffId) {
      return select(
        `SELECT v.variant_id AS id,v.product_id AS productId,CONCAT(p.brand,' ',p.model,' · ',v.horsepower,' HP') AS name,v.horsepower,v.srp,v.promo_price AS promoPrice,v.status,COALESCE(i.on_hand_quantity,0) AS onHand,COALESCE(i.reserved_quantity,0) AS reserved FROM product_variants v JOIN products p ON p.product_id=v.product_id LEFT JOIN inventory i ON i.variant_id=v.variant_id ORDER BY v.variant_id DESC LIMIT 300`,
      );
    },
    createVariant(productId, data) {
      return execute(
        `INSERT INTO product_variants(product_id,horsepower,srp,promo_price,status) VALUES (?,?,?,?,'ACTIVE')`,
        [productId, data.horsepower, data.srp, data.promoPrice],
      );
    },
    updateVariant(recordId, data) {
      return execute(
        `UPDATE product_variants SET srp=?,promo_price=?,status=? WHERE variant_id=?`,
        [data.srp, data.promoPrice, data.status, recordId],
      );
    },
    activeVariant(id) {
      return select(
        `SELECT v.variant_id,v.srp,v.promo_price,v.horsepower,p.product_name,p.model FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE v.variant_id=? AND v.status='ACTIVE' AND p.status='ACTIVE' LIMIT 1 FOR UPDATE`,
        [id],
      );
    },
  };
}
