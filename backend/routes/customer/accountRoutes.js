import express from "express";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import { getCustomerProfileController } from "../../controllers/customer/account/profileController.js";
import { getMyServicesController } from "../../controllers/customer/account/serviceController.js";

import {
  getCustomerAddressesController,
  addCustomerAddressController,
  setDefaultCustomerAddressController,
  deleteCustomerAddressController,
} from "../../controllers/customer/account/addressController.js";

const router = express.Router();

router.use(requireCustomerAuth);

// Customer profile
router.get("/profile", getCustomerProfileController);

// Customer's own service requests
router.get("/my-services", getMyServicesController);

// Saved addresses
router.get("/addresses", getCustomerAddressesController);
router.post("/addresses", addCustomerAddressController);
router.patch(
  "/addresses/:addressId/default",
  setDefaultCustomerAddressController,
);
router.delete("/addresses/:addressId", deleteCustomerAddressController);

export default router;
