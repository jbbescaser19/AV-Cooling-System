import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { customerControllers } from "../../../controllers/management/customers/customerController.js";
const router = Router();
router.get("/", customerControllers.list);
router.patch("/:id", requireCustomerWriteOrigin, customerControllers.update);
export default router;
