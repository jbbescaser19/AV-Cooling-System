/**
 * Resolve legacy AV order numbers in notification text.
 *
 * Only presentation text is changed. Stored notifications
 * and their original navigation links remain untouched.
 */
const oldCode = /\bAV-[0-9A-F]{32}\b/gi;

export async function formatNotificationOrderReferences(
  db,
  rows,
  customerUserId = null,
) {
  const codes = [
    ...new Set(
      rows.flatMap((row) =>
        [row.title, row.message].flatMap((text) =>
          Array.from(String(text ?? "").matchAll(oldCode), (match) =>
            match[0].toUpperCase(),
          ),
        ),
      ),
    ),
  ];

  if (!codes.length) {
    return rows;
  }

  const references = new Map();

  for (let index = 0; index < codes.length; index += 100) {
    const batch = codes.slice(index, index + 100);

    const scope =
      customerUserId == null
        ? ""
        : `AND EXISTS (
             SELECT 1
             FROM customers c
             WHERE c.customer_id=o.customer_id
               AND c.user_id=?
           )`;

    const [orders] = await db.execute(
      `SELECT
         o.order_number AS internalNumber,

         CONCAT('AV-', YEAR(o.ordered_at), '-',
           CASE WHEN o.order_id < 1000000
             THEN LPAD(o.order_id, 6, '0')
             ELSE CAST(o.order_id AS CHAR)
           END
         ) AS displayNumber

       FROM orders o
       WHERE o.order_number IN (
         ${batch.map(() => "?").join(",")}
       )
       ${scope}`,

      customerUserId == null ? batch : [...batch, customerUserId],
    );

    for (const order of orders) {
      references.set(
        String(order.internalNumber).toUpperCase(),
        order.displayNumber,
      );
    }
  }

  const replace = (text) =>
    typeof text === "string"
      ? text.replace(
          oldCode,
          (code) => references.get(code.toUpperCase()) || code,
        )
      : text;

  return rows.map((row) => ({
    ...row,
    title: replace(row.title),
    message: replace(row.message),
  }));
}
