/** Dedicated feedback database queries. */
export function feedbackModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listFeedback(staffId) {
      return select(
        `SELECT f.feedback_id AS id,u.name AS customer,f.rating,f.category,f.comment,f.sentiment,COALESCE(f.allow_public_review,0) AS publicReview,f.staff_reply AS staffReply,f.created_at AS createdAt FROM feedback f JOIN customers c ON c.customer_id=f.customer_id JOIN users u ON u.user_id=c.user_id ORDER BY f.feedback_id DESC LIMIT 200`,
      );
    },
    updateFeedbackReply(id, reply) {
      return execute(`UPDATE feedback SET staff_reply=? WHERE feedback_id=?`, [
        reply,
        id,
      ]);
    },
    async backfillSentiment(id, sentiment) {
      return execute(
        `UPDATE feedback SET sentiment=? WHERE feedback_id=? AND sentiment='NOT_ANALYZED'`,
        [sentiment, id],
      );
    },
  };
}
