import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { categoryControllers } from "../../../controllers/management/catalog/categoryController.js";
const router = Router();
router.get("/", categoryControllers.list);
router.post("/", requireCustomerWriteOrigin, categoryControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, categoryControllers.update);
export default router;
