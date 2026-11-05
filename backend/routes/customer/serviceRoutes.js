import express from "express";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

import {
  createServiceRequestController,
  getActiveServiceTypesController,
  getCustomerServiceRequestsController,
} from "../../controllers/customer/services/serviceRequestController.js";

const router = express.Router();

// Public, read-only service catalog.
router.get("/types", getActiveServiceTypesController);

// Booking and request history require authentication.
router.use(requireCustomerAuth);

router.get("/requests", getCustomerServiceRequestsController);

router.post("/requests", createServiceRequestController);

export default router;
