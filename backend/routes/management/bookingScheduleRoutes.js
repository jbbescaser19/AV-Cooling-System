import { Router } from "express";
import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";
import {
  dayBookingsController,
  changeSlotController,
  changeDayController,
} from "../../controllers/scheduling/bookingScheduleController.js";

const router = Router();

// Staff cookie is scoped to /api/management, so protected routes belong here.
router.use(requireStaffAuth);

router.get("/day", dayBookingsController);

router.patch(
  "/slot",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  changeSlotController,
);

router.patch(
  "/day",
  requireStaffRole("OWNER", "MANAGER"),
  requireCustomerWriteOrigin,
  changeDayController,
);

export default router;
