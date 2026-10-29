import express from "express";

import { getCustomerProfileController } from "../../controllers/customer/profileController.js";

import {
  getCustomerAddressesController,
  addCustomerAddressController,
  setDefaultCustomerAddressController,
  deleteCustomerAddressController,
} from "../../controllers/customer/addressController.js";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

const router = express.Router();

// All account endpoints require an authenticated customer.
router.use(requireCustomerAuth);

// Customer profile
router.get("/profile", getCustomerProfileController);

// Customer addresses
router.get("/addresses", getCustomerAddressesController);
router.post("/addresses", addCustomerAddressController);
router.patch(
  "/addresses/:addressId/default",
  setDefaultCustomerAddressController,
);
router.delete("/addresses/:addressId", deleteCustomerAddressController);

export default router;
