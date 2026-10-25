import express from "express";

import {
  registerCustomerController,
  loginCustomerController,
  getCurrentCustomerController,
  logoutCustomerController,
} from "../../controllers/customer/authController.js";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

const router = express.Router();

router.post("/register", registerCustomerController);

router.post("/login", loginCustomerController);

router.post("/logout", logoutCustomerController);

router.get("/me", requireCustomerAuth, getCurrentCustomerController);

export default router;
