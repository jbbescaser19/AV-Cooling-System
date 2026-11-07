export function cartModel(db) {
  return {
    async customer(userId, lock = false) {
      const [rows] = await db.execute(
        `SELECT c.customer_id AS id
         FROM customers AS c
         INNER JOIN users AS u
           ON u.user_id = c.user_id
         WHERE c.user_id = ?
           AND u.account_type = 'CUSTOMER'
           AND c.status = 'ACTIVE'
           AND u.status = 'ACTIVE'
         LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
        [userId],
      );

      return rows[0] || null;
    },

    async activeCart(customerId) {
      const [rows] = await db.execute(
        `SELECT cart_id AS id
         FROM carts
         WHERE customer_id = ?
           AND status = 'ACTIVE'
         ORDER BY cart_id DESC
         LIMIT 1`,
        [customerId],
      );

      return rows[0]?.id || null;
    },

    async createCart(customerId) {
      const [result] = await db.execute(
        `INSERT INTO carts (customer_id, status)
         VALUES (?, 'ACTIVE')`,
        [customerId],
      );

      return result.insertId;
    },

    async findVariant(catalogKey, horsepower) {
      const [rows] = await db.execute(
        `SELECT pv.variant_id AS variantId
         FROM products AS p
         INNER JOIN product_variants AS pv
           ON pv.product_id = p.product_id
         WHERE p.catalog_key = ?
           AND pv.horsepower = ?
           AND p.status = 'ACTIVE'
           AND pv.status = 'ACTIVE'
         LIMIT 1`,
        [catalogKey, horsepower],
      );

      return rows[0] || null;
    },

    async findCartLine(cartId, variantId) {
      const [rows] = await db.execute(
        `SELECT
           ci.quantity AS qty,
           p.catalog_key AS productId
         FROM cart_items AS ci
         INNER JOIN product_variants AS pv
           ON pv.variant_id = ci.variant_id
         INNER JOIN products AS p
           ON p.product_id = pv.product_id
         WHERE ci.cart_id = ?
           AND ci.variant_id = ?
         LIMIT 1`,
        [cartId, variantId],
      );

      return rows[0] || null;
    },

    async listItems(cartId) {
      if (!cartId) {
        return [];
      }

      const [rows] = await db.execute(
        `SELECT
           ci.variant_id AS variantId,
           p.catalog_key AS productId,
           p.product_name AS name,
           p.brand,
           CONCAT(
             CAST(pv.horsepower AS CHAR),
             'HP'
           ) AS hp,
           ci.quantity AS qty,
           CAST(
             COALESCE(pv.promo_price, pv.srp)
             AS DOUBLE
           ) AS price,
           CAST(pv.srp AS DOUBLE) AS srp
         FROM cart_items AS ci
         INNER JOIN product_variants AS pv
           ON pv.variant_id = ci.variant_id
         INNER JOIN products AS p
           ON p.product_id = pv.product_id
         WHERE ci.cart_id = ?
         ORDER BY ci.cart_item_id`,
        [cartId],
      );

      return rows;
    },

    async listVariantOptions(cartId) {
      if (!cartId) {
        return [];
      }

      const [rows] = await db.execute(
        `SELECT
           p.catalog_key AS productId,
           CONCAT(
             CAST(pv.horsepower AS CHAR),
             'HP'
           ) AS hp,
           CAST(
             COALESCE(pv.promo_price, pv.srp)
             AS DOUBLE
           ) AS price,
           CAST(pv.srp AS DOUBLE) AS srp
         FROM products AS p
         INNER JOIN product_variants AS pv
           ON pv.product_id = p.product_id
         WHERE p.status = 'ACTIVE'
           AND pv.status = 'ACTIVE'
           AND p.product_id IN (
             SELECT DISTINCT current_variant.product_id
             FROM cart_items AS ci
             INNER JOIN product_variants AS current_variant
               ON current_variant.variant_id = ci.variant_id
             WHERE ci.cart_id = ?
           )
         ORDER BY p.product_id, pv.horsepower`,
        [cartId],
      );

      return rows;
    },

    async quantity(cartId) {
      const [rows] = await db.execute(
        `SELECT
           COALESCE(SUM(quantity), 0) AS total
         FROM cart_items
         WHERE cart_id = ?`,
        [cartId],
      );

      return Number(rows[0]?.total || 0);
    },

    async upsert(cartId, variantId, qty) {
      await db.execute(
        `INSERT INTO cart_items (
           cart_id,
           variant_id,
           quantity
         )
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           quantity = quantity + VALUES(quantity)`,
        [cartId, variantId, qty],
      );
    },

    async setQuantity(cartId, variantId, qty) {
      await db.execute(
        `UPDATE cart_items
         SET quantity = ?
         WHERE cart_id = ?
           AND variant_id = ?`,
        [qty, cartId, variantId],
      );
    },

    async remove(cartId, variantId) {
      await db.execute(
        `DELETE FROM cart_items
         WHERE cart_id = ?
           AND variant_id = ?`,
        [cartId, variantId],
      );
    },

    async clear(cartId) {
      await db.execute(
        `DELETE FROM cart_items
         WHERE cart_id = ?`,
        [cartId],
      );
    },

    async hasMerge(customerId, token) {
      const [rows] = await db.execute(
        `SELECT 1
         FROM cart_merge_tokens
         WHERE customer_id = ?
           AND merge_token = ?
         LIMIT 1`,
        [customerId, token],
      );

      return rows.length > 0;
    },

    async markMerge(customerId, token) {
      await db.execute(
        `INSERT INTO cart_merge_tokens (
           customer_id,
           merge_token
         )
         VALUES (?, ?)`,
        [customerId, token],
      );
    },
  };
}
