import { Router } from "express";
import { auditLogControllers } from "../../../controllers/management/administration/auditLogController.js";
const router = Router();
router.get("/", auditLogControllers.list);
export default router;
