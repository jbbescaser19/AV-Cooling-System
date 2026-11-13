import { Router } from "express";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import { staffAuthController } from "../../controllers/management/staffAuthController.js";
import { staffPasswordController } from "../../controllers/management/staffPasswordController.js";

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

router.post(
  "/change-password",
  requireCustomerWriteOrigin,
  requireStaffAuth,
  staffPasswordController.change,
);

router.get(
  "/staff-password-reset",
  requireStaffAuth,
  requireStaffRole("OWNER"),
  staffPasswordController.options,
);

router.post(
  "/staff-password-reset",
  requireCustomerWriteOrigin,
  requireStaffAuth,
  requireStaffRole("OWNER"),
  staffPasswordController.reset,
);

router.post("/logout", requireCustomerWriteOrigin, staffAuthController.logout);

export default router;
