/** Database operations for reversible customer account archival. */
export function customerArchiveModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];

  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];

  return {
    async lockAccount(customerId) {
      const [row] = await select(
        `SELECT
           c.customer_id AS id,
           c.user_id AS userId,
           c.status AS customerStatus,
           u.status AS userStatus,
           u.deleted_at AS deletedAt
         FROM customers c
         JOIN users u ON u.user_id=c.user_id
         WHERE c.customer_id=?
           AND u.account_type='CUSTOMER'
         LIMIT 1 FOR UPDATE`,
        [customerId],
      );

      return row || null;
    },

    async archiveAccount(customerId, userId) {
      await execute(
        `UPDATE customers
         SET status='INACTIVE'
         WHERE customer_id=?`,
        [customerId],
      );

      return execute(
        `UPDATE users
         SET status='INACTIVE',
             deleted_at=NOW(),
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='CUSTOMER'
           AND deleted_at IS NULL`,
        [userId],
      );
    },

    async getSnapshot(archiveId) {
      const [row] = await select(
        `SELECT record_snapshot AS snapshot
         FROM management_archive
         WHERE archive_id=?
           AND module_name='customer-accounts'
           AND state='ARCHIVED'
         LIMIT 1 FOR UPDATE`,
        [archiveId],
      );

      if (!row) return null;

      return typeof row.snapshot === "string"
        ? JSON.parse(row.snapshot)
        : row.snapshot;
    },

    async restoreAccount(customerId, userId, customerStatus, userStatus) {
      await execute(
        `UPDATE customers
         SET status=?
         WHERE customer_id=?`,
        [customerStatus, customerId],
      );

      return execute(
        `UPDATE users
         SET status=?,
             deleted_at=NULL,
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='CUSTOMER'
           AND deleted_at IS NOT NULL
           AND status='INACTIVE'`,
        [userStatus, userId],
      );
    },

    async permanentlyCloseLogin(userId, email, passwordHash) {
      return execute(
        `UPDATE users
         SET name='Deleted customer',
             email=?,
             password_hash=?,
             status='INACTIVE',
             session_version=session_version+1
         WHERE user_id=?
           AND account_type='CUSTOMER'
           AND deleted_at IS NOT NULL
           AND status='INACTIVE'`,
        [email, passwordHash, userId],
      );
    },

    async redactArchiveLabel(archiveId, customerId) {
      return execute(
        `UPDATE management_archive
         SET record_label=?
         WHERE archive_id=?
           AND state='ARCHIVED'`,
        [`Deleted customer #${customerId}`, archiveId],
      );
    },
  };
}
