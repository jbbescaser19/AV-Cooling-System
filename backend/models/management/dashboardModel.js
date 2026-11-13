/**
 * Management dashboard reads only.
 * All dashboard SQL stays inside this model.
 */
export function dashboardModel(db) {
  return {
    async feedbackSentimentSummary() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN sentiment='POSITIVE' THEN 1 ELSE 0 END) AS positive,
                SUM(CASE WHEN sentiment='NEUTRAL' THEN 1 ELSE 0 END) AS neutral,
                SUM(CASE WHEN sentiment='NEGATIVE' THEN 1 ELSE 0 END) AS negative,
                SUM(CASE WHEN sentiment='NOT_ANALYZED' OR sentiment IS NULL THEN 1 ELSE 0 END) AS unanalyzed
         FROM feedback`,
      );
      return rows[0] || {};
    },
    async orderSummary() {
      const [rows] = await db.execute(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN order_status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN order_status IN ('CONFIRMED', 'SCHEDULED', 'IN_PROGRESS') THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN order_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN order_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
           SUM(CASE WHEN payment_status = 'PENDING' AND order_status <> 'CANCELLED'
             THEN total_amount ELSE 0 END) AS awaitingPaymentAmount
         FROM orders`,
      );
      return rows[0];
    },

    async paymentSummary() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS paidCount,
                COALESCE(SUM(amount), 0) AS paidAmount
         FROM (SELECT amount,paid_at,created_at,payment_status FROM payments
           UNION ALL SELECT amount,paid_at,created_at,status AS payment_status FROM service_payments) paid_facts
         WHERE payment_status = 'PAID'`,
      );
      return rows[0];
    },

    async dailyPaidPayments() {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d') AS bucket,
                COUNT(*) AS paymentCount,
                COALESCE(SUM(amount), 0) AS amount
         FROM (SELECT amount,paid_at,created_at,payment_status FROM payments
           UNION ALL SELECT amount,paid_at,created_at,status AS payment_status FROM service_payments) paid_facts
         WHERE payment_status = 'PAID'
           AND COALESCE(paid_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND COALESCE(paid_at, created_at) < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d')
         ORDER BY bucket ASC`,
      );
      return rows;
    },

    async weeklyPaidPayments() {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(
                  DATE_SUB(DATE(COALESCE(paid_at, created_at)),
                    INTERVAL WEEKDAY(COALESCE(paid_at, created_at)) DAY),
                  '%Y-%m-%d'
                ) AS bucket,
                COUNT(*) AS paymentCount,
                COALESCE(SUM(amount), 0) AS amount
         FROM (SELECT amount,paid_at,created_at,payment_status FROM payments
           UNION ALL SELECT amount,paid_at,created_at,status AS payment_status FROM service_payments) paid_facts
         WHERE payment_status = 'PAID'
           AND COALESCE(paid_at, created_at) >= DATE_SUB(
             DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
             INTERVAL 7 WEEK
           )
           AND COALESCE(paid_at, created_at) < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         GROUP BY DATE_FORMAT(
           DATE_SUB(DATE(COALESCE(paid_at, created_at)),
             INTERVAL WEEKDAY(COALESCE(paid_at, created_at)) DAY),
           '%Y-%m-%d'
         )
         ORDER BY bucket ASC`,
      );
      return rows;
    },

    async monthlyPaidPayments() {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m') AS month,
                COUNT(*) AS paymentCount,
                SUM(amount) AS amount
         FROM (SELECT amount,paid_at,created_at,payment_status FROM payments
           UNION ALL SELECT amount,paid_at,created_at,status AS payment_status FROM service_payments) paid_facts
         WHERE payment_status = 'PAID'
           AND COALESCE(paid_at, created_at) >=
             DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
           AND COALESCE(paid_at, created_at) < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m')
         ORDER BY month ASC`,
      );
      return rows;
    },

    async yearlyPaidPayments() {
      const [rows] = await db.execute(
        `SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '%Y') AS bucket,
                COUNT(*) AS paymentCount,
                COALESCE(SUM(amount), 0) AS amount
         FROM (SELECT amount,paid_at,created_at,payment_status FROM payments
           UNION ALL SELECT amount,paid_at,created_at,status AS payment_status FROM service_payments) paid_facts
         WHERE payment_status = 'PAID'
           AND COALESCE(paid_at, created_at) >= MAKEDATE(YEAR(CURDATE()) - 4, 1)
           AND COALESCE(paid_at, created_at) < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         GROUP BY DATE_FORMAT(COALESCE(paid_at, created_at), '%Y')
         ORDER BY bucket ASC`,
      );
      return rows;
    },

    async serviceSummary() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled
         FROM service_requests`,
      );
      return rows[0];
    },

    async customerSummary() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS active
         FROM customers c
         INNER JOIN users u ON u.user_id = c.user_id
         WHERE c.status = 'ACTIVE'
           AND u.status = 'ACTIVE'
           AND u.account_type = 'CUSTOMER'`,
      );
      return rows[0];
    },

    async inventorySummary() {
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS tracked,
                SUM(CASE WHEN GREATEST(on_hand_quantity - reserved_quantity, 0)
                  <= reorder_level THEN 1 ELSE 0 END) AS lowStock
         FROM inventory`,
      );
      return rows[0];
    },

    async recentOrders() {
      const [rows] = await db.execute(
        `SELECT order_id AS id, order_number AS reference,
                recipient_name AS customer, order_status AS status,
                payment_status AS paymentStatus,
                order_channel AS channel,
                total_amount AS amount,
                updated_at AS updatedAt
         FROM orders
         ORDER BY updated_at DESC, order_id DESC
         LIMIT 6`,
      );
      return rows;
    },

    async recentServices() {
      const [rows] = await db.execute(
        `SELECT sr.service_request_id AS id,
                st.service_name AS serviceName,
                u.name AS customer,
                sr.status AS status,
                sr.updated_at AS updatedAt
         FROM service_requests sr
         INNER JOIN service_types st ON st.service_type_id = sr.service_type_id
         INNER JOIN customers c ON c.customer_id = sr.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
         ORDER BY sr.updated_at DESC, sr.service_request_id DESC
         LIMIT 6`,
      );
      return rows;
    },

    async upcomingServices() {
      const [rows] = await db.execute(
        `SELECT sr.service_request_id AS id,
                st.service_name AS serviceName,
                u.name AS customer,
                sr.status AS status,
                sr.preferred_start AS preferredStart
         FROM service_requests sr
         INNER JOIN service_types st ON st.service_type_id = sr.service_type_id
         INNER JOIN customers c ON c.customer_id = sr.customer_id
         LEFT JOIN users u ON u.user_id = c.user_id
         WHERE sr.status IN ('PENDING', 'CONFIRMED')
           AND sr.preferred_start >= NOW()
         ORDER BY sr.preferred_start ASC, sr.service_request_id ASC
         LIMIT 5`,
      );
      return rows;
    },
  };
}
