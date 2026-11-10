import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { variantControllers } from "../../../controllers/management/catalog/variantController.js";
const router = Router();
router.get("/", variantControllers.list);
router.patch("/:id", requireCustomerWriteOrigin, variantControllers.update);
export default router;
