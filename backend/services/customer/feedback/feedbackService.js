import connectDB from "../../../utils/dbConn.js";
import { feedbackModel } from "../../../models/customer/feedback/feedbackModel.js";
import {
  validateFeedback,
  validateFeedbackVisibility,
} from "../../../validators/customer/feedback/feedbackValidator.js";
import { analyzeFeedbackSentiment } from "./sentimentAnalyzer.js";
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function userId(raw) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1)
    fail("Invalid customer session.", 401);
  return id;
}
export async function getCustomerFeedback(user) {
  const model = feedbackModel(connectDB),
    customer = await model.findActiveCustomer(userId(user));
  if (!customer) fail("Active customer required.", 403);
  const [feedback, orders, services] = await Promise.all([
    model.listCustomerFeedback(customer.id),
    model.availableOrders(customer.id),
    model.availableServices(customer.id),
  ]);
  return {
    feedback: feedback.map((x) => ({
      ...x,
      allowPublicReview: Boolean(x.allowPublicReview),
      canPublish: Boolean(x.canPublish),
    })),
    availableTargets: [...orders, ...services],
  };
}
export async function getPublicFeedback(rawLimit = 30) {
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30)
    fail("Invalid review limit.");
  return { reviews: await feedbackModel(connectDB).publicReviews(limit) };
}
export async function submitCustomerFeedback(user, input) {
  const data = validateFeedback(input);
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = feedbackModel(connection),
      customer = await model.findActiveCustomer(userId(user), true);
    if (!customer) fail("Active customer required.", 403);
    if (data.subjectKind !== "GENERAL") {
      const eligible =
        data.subjectKind === "ORDER"
          ? await model.orderEligible(customer.id, data.subjectId)
          : await model.serviceEligible(customer.id, data.subjectId);
      if (!eligible.length)
        fail("Choose a completed order or service that belongs to you.", 409);
      if (
        (
          await model.alreadyReviewed(
            customer.id,
            data.subjectKind,
            data.subjectId,
          )
        ).length
      )
        fail("You already reviewed this order or service.", 409);
    } else if ((await model.recentlySubmittedGeneral(customer.id, data)).length)
      fail("This feedback was just submitted.", 409);
    const sentiment = analyzeFeedbackSentiment(data.comment, data.rating);
    const inserted = await model.insert(customer.id, data, sentiment);
    await model.auditStaffAlert(
      "New customer feedback",
      "A customer submitted feedback. Review it in Management → Feedback.",
    );
    await connection.commit();
    return {
      feedbackId: inserted.insertId,
      message: "Your feedback was submitted. Thank you!",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function changeFeedbackVisibility(user, rawId, input) {
  const data = validateFeedbackVisibility(input),
    feedbackId = Number(rawId);
  if (!Number.isSafeInteger(feedbackId) || feedbackId < 1)
    fail("Invalid feedback ID.");
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = feedbackModel(connection),
      customer = await model.findActiveCustomer(userId(user), true);
    if (!customer) fail("Active customer required.", 403);
    const matches = await model.ownedReview(customer.id, feedbackId),
      feedback = matches[0];
    if (!feedback) fail("Feedback not found.", 404);
    if (data.allowPublicReview) {
      const valid =
        feedback.orderId != null
          ? await model.orderEligible(customer.id, feedback.orderId)
          : feedback.serviceId != null
            ? await model.serviceEligible(customer.id, feedback.serviceId)
            : [];
      if (!valid.length)
        fail("Only completed order or service feedback may be public.", 409);
    }
    await model.changeVisibility(
      customer.id,
      feedbackId,
      data.allowPublicReview,
    );
    await connection.commit();
    return {
      allowPublicReview: data.allowPublicReview,
      message: data.allowPublicReview
        ? "Review is now publicly visible."
        : "Review is now private.",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
