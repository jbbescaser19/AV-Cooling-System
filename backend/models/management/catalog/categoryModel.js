/** Dedicated category database queries. */
export function categoryModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listCategories(staffId) {
      return select(
        `SELECT category_id AS id,category_name AS name,description,status FROM product_categories ORDER BY category_id DESC LIMIT 100`,
      );
    },
    createCategory(data) {
      return execute(
        `INSERT INTO product_categories(category_name,description,status) VALUES (?,?,'ACTIVE')`,
        [data.name, data.description],
      );
    },
    updateCategory(id, data) {
      return execute(
        `UPDATE product_categories SET category_name=?,description=?,status=? WHERE category_id=?`,
        [data.name, data.description, data.status, id],
      );
    },
  };
}
