import { Router } from "express";
import { availabilityController } from "../../controllers/scheduling/bookingScheduleController.js";

const router = Router();

// Only non-sensitive availability is public; no customer or staff details.
router.get("/availability", availabilityController);

export default router;
