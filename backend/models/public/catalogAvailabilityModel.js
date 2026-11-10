/** Read-only availability for the public storefront. */
export function catalogAvailabilityModel(db) {
  return {
    async listAvailableVariants() {
      const [rows] = await db.execute(
        `SELECT
           COALESCE(NULLIF(p.catalog_key, ''), p.model) AS productId,
           CONCAT(CAST(v.horsepower AS CHAR), 'HP') AS hp,
           v.variant_id AS variantId,
           CAST(v.srp AS DOUBLE) AS srp,
           CAST(CASE WHEN v.promo_price > 0 AND v.promo_price < v.srp
             THEN v.promo_price ELSE v.srp END AS DOUBLE) AS price,
           GREATEST(COALESCE(i.on_hand_quantity, 0) -
             COALESCE(i.reserved_quantity, 0), 0) AS available
         FROM products AS p
         INNER JOIN product_variants AS v ON v.product_id = p.product_id
         LEFT JOIN inventory AS i ON i.variant_id = v.variant_id
         WHERE p.status = 'ACTIVE' AND v.status = 'ACTIVE'
         ORDER BY p.product_id, v.horsepower`,
      );
      return rows;
    },
  };
}
