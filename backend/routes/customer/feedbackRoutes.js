import { Router } from "express";
import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import {
  listPublicFeedbackController,
  listCustomerFeedbackController,
  createCustomerFeedbackController,
  changeFeedbackVisibilityController,
} from "../../controllers/customer/feedback/feedbackController.js";
const router = Router();
router.get("/public", listPublicFeedbackController);
router.use(requireCustomerAuth);
router.get("/", listCustomerFeedbackController);
router.post("/", requireCustomerWriteOrigin, createCustomerFeedbackController);
router.patch(
  "/:feedbackId/public-visibility",
  requireCustomerWriteOrigin,
  changeFeedbackVisibilityController,
);
export default router;
