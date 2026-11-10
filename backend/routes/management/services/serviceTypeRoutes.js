import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { serviceTypeControllers } from "../../../controllers/management/services/serviceTypeController.js";
const router = Router();
router.get("/", serviceTypeControllers.list);
router.post("/", requireCustomerWriteOrigin, serviceTypeControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, serviceTypeControllers.update);
export default router;
