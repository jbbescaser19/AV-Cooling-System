import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { technicianControllers } from "../../../controllers/management/services/technicianController.js";
const router = Router();
router.get("/", technicianControllers.list);
router.post("/", requireCustomerWriteOrigin, technicianControllers.create);
router.patch("/:id", requireCustomerWriteOrigin, technicianControllers.update);
export default router;
