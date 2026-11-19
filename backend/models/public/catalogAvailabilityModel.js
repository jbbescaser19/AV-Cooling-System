/** Read-only product catalog for the public storefront. */
export function catalogAvailabilityModel(db) {
  return {
    async listCatalog() {
      const [rows] = await db.execute(
        `SELECT
           COALESCE(NULLIF(p.catalog_key, ''), p.model) AS productId,
           p.product_name AS name,
           p.brand,
           p.model,
           c.category_name AS category,

           v.variant_id AS variantId,
           CONCAT(CAST(v.horsepower AS CHAR), 'HP') AS hp,

           CAST(v.srp AS DOUBLE) AS srp,

           CAST(
             CASE
               WHEN v.promo_price > 0
                    AND v.promo_price < v.srp
               THEN v.promo_price
               ELSE v.srp
             END AS DOUBLE
           ) AS price,

           GREATEST(
             COALESCE(i.on_hand_quantity, 0) -
             COALESCE(i.reserved_quantity, 0),
             0
           ) AS available

         FROM products AS p

         INNER JOIN product_categories AS c
           ON c.category_id = p.category_id

         LEFT JOIN product_variants AS v
           ON v.product_id = p.product_id
           AND v.status = 'ACTIVE'

         LEFT JOIN inventory AS i
           ON i.variant_id = v.variant_id

         WHERE p.status = 'ACTIVE'
           AND c.status = 'ACTIVE'

         ORDER BY p.product_id, v.horsepower`,
      );

      return rows;
    },
  };
}
