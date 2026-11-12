import {
  getAvailability,
  getCalendarDay,
  updateCalendarSlot,
  updateCalendarDay,
  getMyTechnicianCalendar,
} from "../../services/scheduling/bookingScheduleService.js";

const handle = (action) => async (req, res) => {
  try {
    return res.json({ success: true, ...(await action(req)) });
  } catch (error) {
    const status =
      Number(error.status) >= 400 && Number(error.status) < 500
        ? Number(error.status)
        : 500;
    if (status === 500) console.error("Booking calendar:", error);
    return res
      .status(status)
      .json({
        success: false,
        message:
          status === 500 ? "Unable to load booking calendar." : error.message,
      });
  }
};

export const availabilityController = handle(async (req) =>
  getAvailability(req.query.month),
);
export const dayBookingsController = handle(async (req) => ({
  bookings: await getCalendarDay(req.staff, req.query.date),
}));
export const changeSlotController = handle(async (req) =>
  updateCalendarSlot(req.staff, req.body),
);
export const changeDayController = handle(async (req) =>
  updateCalendarDay(req.staff, req.body),
);

export const myTechnicianCalendarController = handle(async (req) =>
  getMyTechnicianCalendar(req.staff, req.query.month),
);
