/** Dedicated staffManagement database queries. */
export function staffManagementModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listStaff(staffId) {
      return select(
        `SELECT user_id AS id,name,email,role,status,last_login_at AS lastLogin FROM users WHERE account_type='STAFF' AND deleted_at IS NULL ORDER BY user_id DESC LIMIT 200`,
      );
    },
    getStaffByEmail(email) {
      return select(
        `SELECT user_id FROM users WHERE email=? LIMIT 1 FOR UPDATE`,
        [email],
      );
    },
    createStaff(data, hash) {
      return execute(
        `INSERT INTO users(name,email,password_hash,account_type,status,role) VALUES (?,?,?,'STAFF','ACTIVE',?)`,
        [data.name, data.email, hash, data.role],
      );
    },
    staffForUpdate(id) {
      return select(
        `SELECT user_id,role,status FROM users WHERE user_id=? AND account_type='STAFF' FOR UPDATE`,
        [id],
      );
    },
    changeStaff(id, role, status) {
      return execute(
        `UPDATE users SET role=?,status=? WHERE user_id=? AND account_type='STAFF'`,
        [role, status, id],
      );
    },
  };
}
