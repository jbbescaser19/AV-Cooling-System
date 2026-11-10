import { Router } from "express";
import { reportControllers } from "../../../controllers/management/operations/reportController.js";
const router = Router();
router.get("/", reportControllers.list);
export default router;
