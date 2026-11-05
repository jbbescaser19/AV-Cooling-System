export function customerAddressModel(db) {
  return {
    findCustomerByUserId(userId, forUpdate = false) {
      const lockClause = forUpdate ? " FOR UPDATE" : "";

      return db.execute(
        `SELECT
          c.customer_id AS customerId,
          c.status AS customerStatus,
          u.status AS userStatus
        FROM customers AS c
        INNER JOIN users AS u
          ON u.user_id = c.user_id
        WHERE u.user_id = ?
          AND u.account_type = 'CUSTOMER'
        LIMIT 1${lockClause}`,
        [userId],
      );
    },

    findAddressesByCustomerId(customerId) {
      return db.execute(
        `SELECT
          address_id AS id,
          label,
          full_address AS address,
          is_default AS isDefault,
          created_at AS createdAt
        FROM customer_addresses
        WHERE customer_id = ?
        ORDER BY is_default DESC, created_at DESC, address_id DESC`,
        [customerId],
      );
    },

    countAddresses(customerId) {
      return db.execute(
        `SELECT COUNT(*) AS total
         FROM customer_addresses
         WHERE customer_id = ?`,
        [customerId],
      );
    },

    createAddress(customerId, label, fullAddress, isDefault) {
      return db.execute(
        `INSERT INTO customer_addresses
          (customer_id, label, full_address, is_default)
         VALUES (?, ?, ?, ?)`,
        [customerId, label, fullAddress, isDefault ? 1 : 0],
      );
    },

    findAddressById(customerId, addressId) {
      return db.execute(
        `SELECT
          address_id AS id,
          label,
          full_address AS address,
          is_default AS isDefault
        FROM customer_addresses
        WHERE address_id = ?
          AND customer_id = ?
        LIMIT 1`,
        [addressId, customerId],
      );
    },

    clearDefaultAddresses(customerId) {
      return db.execute(
        `UPDATE customer_addresses
         SET is_default = 0
         WHERE customer_id = ?`,
        [customerId],
      );
    },

    setAddressDefault(customerId, addressId) {
      return db.execute(
        `UPDATE customer_addresses
         SET is_default = 1
         WHERE customer_id = ?
           AND address_id = ?`,
        [customerId, addressId],
      );
    },

    deleteAddress(customerId, addressId) {
      return db.execute(
        `DELETE FROM customer_addresses
         WHERE customer_id = ?
           AND address_id = ?`,
        [customerId, addressId],
      );
    },
  };
}
