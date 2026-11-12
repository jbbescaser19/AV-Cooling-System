import { Router } from "express";

import { upcomingAgendaController } from "../../controllers/management/services/upcomingAgendaController.js";

import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  dayBookingsController,
  myTechnicianCalendarController,
  changeSlotController,
  changeDayController,
} from "../../controllers/scheduling/bookingScheduleController.js";

const router = Router();

// Staff cookie is scoped to /api/management.
router.use(requireStaffAuth);

router.get(
  "/upcoming",
  requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"),
  upcomingAgendaController,
);

router.get(
  "/my-calendar",
  requireStaffRole("TECHNICIAN"),
  myTechnicianCalendarController,
);

router.get("/day", requireStaffRole("OWNER", "MANAGER"), dayBookingsController);

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
