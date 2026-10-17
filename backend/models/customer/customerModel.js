export function customerModel(db) {
  return {
    /**
     **Find an existing account by email.
     */

    findUserByEmail(email) {
      return db.execute("SELECT user_id FROM users WHERE email = ? LIMIT 1", [
        email,
      ]);
    },

    /**
     ** Create the main user account.
     */

    createUser(
      fullName,
      email,
      accountType,
      passwordHash,
      role = null,
      status = "ACTIVE",
    ) {
      return db.execute(
        `INSERT INTO users
          (name, email, account_type, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fullName, email, accountType, passwordHash, role, status],
      );
    },

    /**
     ** Create the customer profile linked to the user.
     */
    createCustomer(userId, phone, status = "ACTIVE") {
      return db.execute(
        `INSERT INTO customers (user_id, phone, status)
         VALUES (?, ?, ?)`,
        [userId, phone, status],
      );
    },
  };
}
