import express from "express";

import {
  registerCustomerController,
  loginCustomerController,
  refreshCustomerSessionController,
  checkCustomerSessionController,
  logoutCustomerController,
} from "../../controllers/customer/authController.js";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

const router = express.Router();

router.post("/register", registerCustomerController);
router.post("/login", loginCustomerController);

// Renew the access token using the refresh-token cookie.
router.post("/refresh", refreshCustomerSessionController);

// Check whether the current access token is valid.
router.get("/session", requireCustomerAuth, checkCustomerSessionController);

router.post("/logout", logoutCustomerController);

export default router;
