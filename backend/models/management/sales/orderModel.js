/** SQL for the order management feature. */
export function orderModel(db) {
  return {
    async orders(filters) {
      const where = [];
      const params = [];
      if (filters.status !== "ALL") {
        where.push("o.order_status = ?");
        params.push(filters.status);
      }
      if (filters.channel !== "ALL") {
        where.push("o.order_channel = ?");
        params.push(filters.channel);
      }
      if (filters.search) {
        const term = `%${filters.search.replace(/[!%_]/g, (char) => `!${char}`)}%`;
        where.push(
          "(o.order_number LIKE ? ESCAPE '!' OR o.recipient_name LIKE ? ESCAPE '!' OR o.contact_number LIKE ? ESCAPE '!')",
        );
        params.push(term, term, term);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [[totalRow]] = await db.execute(
        `SELECT COUNT(*) AS total FROM orders o ${whereSql}`,
        params,
      );
      const total = Number(totalRow?.total) || 0;
      const offset = (filters.page - 1) * filters.pageSize;
      const [rows] = await db.execute(
        `SELECT o.order_id AS id, o.order_number AS orderNumber, CONCAT('AV-', YEAR(o.ordered_at), '-',
                      CASE WHEN o.order_id < 1000000
                        THEN LPAD(o.order_id, 6, '0')
                        ELSE CAST(o.order_id AS CHAR)
                      END) AS reference,
                    o.order_channel AS channel, o.recipient_name AS customer,
                    o.order_status AS status, o.payment_status AS paymentStatus,
                    o.contact_number AS contact,
                    CAST(o.total_amount AS CHAR) AS total,
                    CAST(o.delivery_fee AS CHAR) AS deliveryFee,
                    o.ordered_at AS createdAt,
                    COALESCE(itemSummary.totalUnits, 0) AS totalUnits,
                    COALESCE(itemSummary.productLines, 0) AS productLines,
                    COALESCE(itemSummary.firstProduct, '') AS firstProduct,
                    DATE_FORMAT(o.preferred_schedule, '%Y-%m-%dT%H:%i') AS schedule,
                    EXISTS (SELECT 1 FROM work_orders w
                      WHERE w.order_id=o.order_id AND w.status IN ('IN_PROGRESS','COMPLETED')) AS workAlreadyStarted,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                        AND e.event_code='ORDER_OUT_FOR_DELIVERY') AS outForDelivery,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                        AND e.event_code='ORDER_DELIVERED') AS delivered,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=o.order_id
                        AND e.event_code='INSTALLATION_STARTED') AS installationStarted
             FROM orders o
             LEFT JOIN (
               SELECT order_id, COUNT(*) AS productLines,
                      SUM(quantity) AS totalUnits,
                      SUBSTRING_INDEX(
                        GROUP_CONCAT(CONCAT(quantity, ' × ', product_name_snapshot)
                          ORDER BY order_item_id SEPARATOR ' | '),
                        ' | ', 1
                      ) AS firstProduct
                 FROM order_items GROUP BY order_id
             ) itemSummary ON itemSummary.order_id = o.order_id
             ${whereSql}
             ORDER BY o.order_id DESC LIMIT ? OFFSET ?`,
        [...params, filters.pageSize, offset],
      );
      return {
        rows,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      };
    },
    async orderDetails(id) {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_number AS orderNumber, CONCAT('AV-', YEAR(ordered_at), '-',
                      CASE WHEN order_id < 1000000
                        THEN LPAD(order_id, 6, '0')
                        ELSE CAST(order_id AS CHAR)
                      END) AS reference,
                    order_channel AS channel, recipient_name AS customer,
                    contact_number AS phone, fulfillment_method AS fulfillment,
                    delivery_address AS address, order_status AS status,
                    EXISTS (SELECT 1 FROM work_orders w
                      WHERE w.order_id=orders.order_id AND w.status IN ('IN_PROGRESS','COMPLETED')) AS workAlreadyStarted,
                    EXISTS (SELECT 1 FROM fulfillment_events e
                      WHERE e.event_kind='ORDER' AND e.record_id=orders.order_id
                        AND e.event_code='ORDER_OUT_FOR_DELIVERY') AS outForDelivery,
                    payment_status AS paymentStatus,
                    CAST(subtotal AS CHAR) AS subtotal,
                    CAST(discount_amount AS CHAR) AS discount,
                    CAST(additional_fee_amount AS CHAR) AS additionalFee,
                    additional_fee_reason AS additionalFeeReason,
                    CAST(total_amount AS CHAR) AS total,
                    CAST(delivery_fee AS CHAR) AS deliveryFee,
                    DATE_FORMAT(preferred_schedule, '%Y-%m-%dT%H:%i') AS schedule,
                    ordered_at AS createdAt
             FROM orders WHERE order_id = ? LIMIT 1`,
        [id],
      );
      return rows[0] || null;
    },
    async orderItems(id) {
      const [rows] = await db.execute(
        `SELECT product_name_snapshot AS name, model_snapshot AS model,
                    quantity, installation_included AS installationIncluded,
                    CAST(unit_price AS CHAR) AS unitPrice,
                    CAST(line_total AS CHAR) AS lineTotal
             FROM order_items WHERE order_id = ? ORDER BY order_item_id`,
        [id],
      );
      return rows;
    },
    async confirmFacebookOrder(orderId) {
      const [r] = await db.execute(
        `UPDATE orders SET payment_status='PAID' WHERE order_id=? AND order_channel='FACEBOOK' AND payment_status='PENDING'`,
        [orderId],
      );
      return r.affectedRows;
    },
  };
}
