import express from "express";
import { registerCustomerController } from "../../controllers/customer/authController.js";

const router = express.Router();

router.post("/register", registerCustomerController);

export default router;
