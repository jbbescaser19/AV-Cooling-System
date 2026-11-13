export function feedbackModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const exec = async (sql, values = []) => (await db.execute(sql, values))[0];
  return {
    async findActiveCustomer(userId, lock = false) {
      const rows = await select(
        `SELECT c.customer_id AS id FROM customers c JOIN users u ON u.user_id=c.user_id WHERE u.user_id=? AND u.account_type='CUSTOMER' AND u.status='ACTIVE' AND c.status='ACTIVE' LIMIT 1${lock ? " FOR UPDATE" : ""}`,
        [userId],
      );
      return rows[0] || null;
    },
    async listCustomerFeedback(id) {
      return select(
        `SELECT f.feedback_id AS id,f.category,f.rating,f.comment,f.sentiment,f.allow_public_review AS allowPublicReview,f.staff_reply AS staffReply,DATE_FORMAT(f.created_at,'%Y-%m-%d %H:%i') AS createdAt,CASE WHEN o.order_id IS NOT NULL THEN CONCAT('Order ',o.order_number) WHEN sr.service_request_id IS NOT NULL THEN CONCAT(st.service_name,' #',sr.service_request_id) ELSE 'General feedback' END AS subjectLabel,CASE WHEN o.order_status='COMPLETED' OR sr.status='COMPLETED' THEN 1 ELSE 0 END AS canPublish FROM feedback f LEFT JOIN orders o ON o.order_id=f.order_id LEFT JOIN service_requests sr ON sr.service_request_id=f.service_request_id LEFT JOIN service_types st ON st.service_type_id=sr.service_type_id WHERE f.customer_id=? ORDER BY f.feedback_id DESC LIMIT 100`,
        [id],
      );
    },
    availableOrders(id) {
      return select(
        `SELECT 'ORDER' AS subjectKind,o.order_id AS subjectId,CONCAT('Order ',o.order_number) AS label FROM orders o WHERE o.customer_id=? AND o.order_status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.order_id=o.order_id AND f.customer_id=?) ORDER BY o.order_id DESC LIMIT 50`,
        [id, id],
      );
    },
    availableServices(id) {
      return select(
        `SELECT 'SERVICE' AS subjectKind,s.service_request_id AS subjectId,CONCAT(t.service_name,' #',s.service_request_id) AS label FROM service_requests s JOIN service_types t ON t.service_type_id=s.service_type_id WHERE s.customer_id=? AND s.status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.service_request_id=s.service_request_id AND f.customer_id=?) ORDER BY s.service_request_id DESC LIMIT 50`,
        [id, id],
      );
    },
    orderEligible(customerId, id) {
      return select(
        `SELECT order_id AS id FROM orders WHERE order_id=? AND customer_id=? AND order_status='COMPLETED' LIMIT 1`,
        [id, customerId],
      );
    },
    serviceEligible(customerId, id) {
      return select(
        `SELECT service_request_id AS id FROM service_requests WHERE service_request_id=? AND customer_id=? AND status='COMPLETED' LIMIT 1`,
        [id, customerId],
      );
    },
    alreadyReviewed(customerId, kind, id) {
      return select(
        kind === "ORDER"
          ? `SELECT feedback_id FROM feedback WHERE customer_id=? AND order_id=? LIMIT 1`
          : `SELECT feedback_id FROM feedback WHERE customer_id=? AND service_request_id=? LIMIT 1`,
        [customerId, id],
      );
    },
    recentlySubmittedGeneral(id, data) {
      return select(
        `SELECT feedback_id FROM feedback WHERE customer_id=? AND order_id IS NULL AND service_request_id IS NULL AND category=? AND rating=? AND comment=? AND created_at>=DATE_SUB(NOW(),INTERVAL 60 SECOND) LIMIT 1`,
        [id, data.category, data.rating, data.comment],
      );
    },
    insert(id, data, sentiment) {
      return exec(
        `INSERT INTO feedback(customer_id,order_id,service_request_id,category,rating,comment,sentiment,allow_public_review) VALUES (?,?,?,?,?,?,?,?)`,
        [
          id,
          data.subjectKind === "ORDER" ? data.subjectId : null,
          data.subjectKind === "SERVICE" ? data.subjectId : null,
          data.category,
          data.rating,
          data.comment,
          sentiment,
          data.allowPublicReview ? 1 : 0,
        ],
      );
    },
    ownedReview(customerId, feedbackId) {
      return select(
        `SELECT feedback_id AS id,order_id AS orderId,service_request_id AS serviceId FROM feedback WHERE customer_id=? AND feedback_id=? LIMIT 1`,
        [customerId, feedbackId],
      );
    },
    changeVisibility(customerId, feedbackId, isPublic) {
      return exec(
        `UPDATE feedback SET allow_public_review=? WHERE feedback_id=? AND customer_id=?`,
        [isPublic ? 1 : 0, feedbackId, customerId],
      );
    },
    publicReviews(limit) {
      return select(
        `SELECT f.feedback_id AS id,f.category,f.rating,f.comment,DATE_FORMAT(f.created_at,'%b %Y') AS dateLabel,CONCAT(SUBSTRING_INDEX(TRIM(u.name),' ',1),IF(TRIM(u.name) LIKE '% %',CONCAT(' ',LEFT(SUBSTRING_INDEX(TRIM(u.name),' ',-1),1),'.'),'')) AS reviewerName,IF(o.order_id IS NOT NULL,'Verified purchase','Verified service') AS sourceLabel FROM feedback f JOIN customers c ON c.customer_id=f.customer_id JOIN users u ON u.user_id=c.user_id LEFT JOIN orders o ON o.order_id=f.order_id LEFT JOIN service_requests sr ON sr.service_request_id=f.service_request_id WHERE f.allow_public_review=1 AND u.account_type='CUSTOMER' AND u.status='ACTIVE' AND c.status='ACTIVE' AND ((o.order_id IS NOT NULL AND o.customer_id=f.customer_id AND o.order_status='COMPLETED') OR (sr.service_request_id IS NOT NULL AND sr.customer_id=f.customer_id AND sr.status='COMPLETED')) ORDER BY f.feedback_id DESC LIMIT ?`,
        [limit],
      );
    },
    auditStaffAlert(title, message) {
      return exec(
        `INSERT INTO notifications(user_id,notification_type,title,message) SELECT user_id,'FEEDBACK',?,? FROM users WHERE account_type='STAFF' AND role IN ('OWNER','MANAGER') AND status='ACTIVE'`,
        [title, message],
      );
    },
  };
}
