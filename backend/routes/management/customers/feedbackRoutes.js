import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { feedbackControllers } from "../../../controllers/management/customers/feedbackController.js";
const router = Router();
router.get("/", feedbackControllers.list);
router.patch("/:id", requireCustomerWriteOrigin, feedbackControllers.update);
export default router;
