import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { productControllers } from "../../../controllers/management/catalog/productController.js";
const router = Router();
router.get("/", productControllers.list);
router.post("/", requireCustomerWriteOrigin, productControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, productControllers.update);
export default router;
