import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { scheduleControllers } from "../../../controllers/management/services/scheduleController.js";
const router = Router();
router.get("/", scheduleControllers.list);
router.post("/", requireCustomerWriteOrigin, scheduleControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, scheduleControllers.update);
export default router;
