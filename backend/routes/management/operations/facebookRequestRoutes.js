import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import { facebookRequestControllers } from "../../../controllers/management/operations/facebookRequestController.js";
const router = Router();
router.get("/", facebookRequestControllers.list);
router.post("/", requireCustomerWriteOrigin, facebookRequestControllers.create);
router.patch(
  "/:id",
  requireCustomerWriteOrigin,
  facebookRequestControllers.update,
);
export default router;
