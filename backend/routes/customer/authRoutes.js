import express from "express";

import {
  registerCustomerController,
  verifyCustomerRegistrationController,
  loginCustomerController,
  refreshCustomerSessionController,
  checkCustomerSessionController,
  logoutCustomerController,
} from "../../controllers/customer/auth/authController.js";

import {
  requestPasswordResetController,
  confirmPasswordResetController,
} from "../../controllers/customer/auth/passwordResetController.js";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

const router = express.Router();

router.post("/register", registerCustomerController);

router.post("/register/verify", verifyCustomerRegistrationController);

router.post("/login", loginCustomerController);

router.post(
  "/password-reset/request",
  requireCustomerWriteOrigin,
  requestPasswordResetController,
);

router.post(
  "/password-reset/confirm",
  requireCustomerWriteOrigin,
  confirmPasswordResetController,
);

router.post("/refresh", refreshCustomerSessionController);

router.get("/session", requireCustomerAuth, checkCustomerSessionController);

router.post("/logout", logoutCustomerController);

export default router;
