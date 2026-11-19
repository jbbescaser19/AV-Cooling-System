import { Router } from "express";
import { availabilityController } from "../../controllers/scheduling/bookingScheduleController.js";

const router = Router();

// Only non-sensitive availability is public.
// Always retrieve the latest availability instead
// of reusing a cached calendar response.
router.get(
  "/availability",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  availabilityController,
);

export default router;
