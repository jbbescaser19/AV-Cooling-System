import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { workOrderControllers } from "../../../controllers/management/services/workOrderController.js";
const router = Router();
router.get("/", workOrderControllers.list);
router.post("/", requireCustomerWriteOrigin, workOrderControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, workOrderControllers.update);
export default router;
