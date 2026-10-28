import express from "express";

import { getCustomerProfileController } from "../../controllers/customer/accountController.js";

import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";

const router = express.Router();

router.use(requireCustomerAuth);

// GET /api/customer/account/profile
router.get("/profile", getCustomerProfileController);

export default router;
