import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { inventoryControllers } from "../../../controllers/management/catalog/inventoryController.js";
const router = Router();
router.get("/", inventoryControllers.list);
router.post("/", requireCustomerWriteOrigin, inventoryControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, inventoryControllers.update);
export default router;
