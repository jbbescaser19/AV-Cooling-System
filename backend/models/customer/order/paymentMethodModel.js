/**
 * Reads the payment methods enabled in Management.
 * Keep all payment-method SQL inside this Model.
 */
const SUPPORTED_PAYMENT_CODES = new Set(["CASH", "GCASH", "BANK_TRANSFER"]);

export function paymentMethodModel(db) {
  return {
    async enabledMethods() {
      const [rows] = await db.execute(
        `SELECT code
         FROM payment_methods
         WHERE is_enabled = 1
           AND code IN ('CASH', 'GCASH', 'BANK_TRANSFER')
         ORDER BY FIELD(code, 'CASH', 'GCASH', 'BANK_TRANSFER')`,
      );

      return rows.map((row) => row.code);
    },

    async isEnabled(code) {
      if (!SUPPORTED_PAYMENT_CODES.has(code)) {
        return false;
      }

      const [rows] = await db.execute(
        `SELECT 1 AS enabled
         FROM payment_methods
         WHERE code = ? AND is_enabled = 1
         LIMIT 1`,
        [code],
      );

      return rows.length > 0;
    },
  };
}
