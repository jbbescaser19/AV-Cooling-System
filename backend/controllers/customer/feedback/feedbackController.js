import {
  getCustomerFeedback,
  getPublicFeedback,
  submitCustomerFeedback,
  changeFeedbackVisibility,
} from "../../../services/customer/feedback/feedbackService.js";
function handle(fn, code = 200) {
  return async (req, res) => {
    try {
      return res.status(code).json({ success: true, ...(await fn(req)) });
    } catch (error) {
      const status =
        Number(error.status) >= 400 && Number(error.status) < 500
          ? Number(error.status)
          : 500;
      if (status === 500) console.error("Feedback:", error);
      return res
        .status(status)
        .json({
          success: false,
          message: status === 500 ? "Feedback is unavailable." : error.message,
        });
    }
  };
}
export const listPublicFeedbackController = handle((req) =>
  getPublicFeedback(req.query.limit ?? 30),
);
export const listCustomerFeedbackController = handle((req) =>
  getCustomerFeedback(req.auth.userId),
);
export const createCustomerFeedbackController = handle(
  (req) => submitCustomerFeedback(req.auth.userId, req.body),
  201,
);
export const changeFeedbackVisibilityController = handle((req) =>
  changeFeedbackVisibility(req.auth.userId, req.params.feedbackId, req.body),
);
