/** Dedicated product database queries. */
export function productModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listProducts(staffId) {
      return select(
        `SELECT p.product_id AS id,p.product_name AS name,p.brand,p.model,p.category_id AS categoryId,c.category_name AS category,p.status,COUNT(v.variant_id) AS variants,MIN(v.srp) AS startingPrice FROM products p JOIN product_categories c ON c.category_id=p.category_id LEFT JOIN product_variants v ON v.product_id=p.product_id GROUP BY p.product_id ORDER BY p.product_id DESC LIMIT 200`,
      );
    },
    createProduct(data) {
      return execute(
        `INSERT INTO products(category_id,product_name,brand,model,status) VALUES (?,?,?,?,'ACTIVE')`,
        [data.categoryId, data.name, data.brand, data.model],
      );
    },
    updateProduct(recordId, data) {
      return execute(
        `UPDATE products SET product_name=?,brand=?,model=?,status=? WHERE product_id=?`,
        [data.name, data.brand, data.model, data.status, recordId],
      );
    },
  };
}
