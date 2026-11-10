import { Router } from "express";
import { stockMovementControllers } from "../../../controllers/management/catalog/stockMovementController.js";
const router = Router();
router.get("/", stockMovementControllers.list);
export default router;
