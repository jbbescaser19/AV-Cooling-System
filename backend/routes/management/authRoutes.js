import { Router } from "express";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import { requireStaffAuth } from "../../middleware/requireStaffAuth.js";
import { staffAuthController } from "../../controllers/management/staffAuthController.js";

const router = Router();

router.post("/login", requireCustomerWriteOrigin, staffAuthController.login);
router.post(
  "/refresh",
  requireCustomerWriteOrigin,
  staffAuthController.refresh,
);
router.get("/session", requireStaffAuth, staffAuthController.session);
router.post(
  "/activity",
  requireCustomerWriteOrigin,
  requireStaffAuth,
  staffAuthController.activity,
);
router.post(
  "/reauthenticate",
  requireCustomerWriteOrigin,
  requireStaffAuth,
  staffAuthController.reauthenticate,
);
router.post("/logout", requireCustomerWriteOrigin, staffAuthController.logout);

export default router;
