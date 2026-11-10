import { Router } from "express";
import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import {
  getSourceTeamController,
  saveSourceTeamController,
} from "../../../controllers/management/services/sourceTeamController.js";

const router = Router();
router.use(requireStaffRole("OWNER", "MANAGER"));
router.get("/:kind/:id", getSourceTeamController);
router.patch(
  "/:kind/:id",
  requireCustomerWriteOrigin,
  saveSourceTeamController,
);
export default router;
