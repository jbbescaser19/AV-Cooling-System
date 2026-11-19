import { createModuleControllers } from "../workspaceController.js";

import { getScheduleCalendar } from "../../../services/management/services/scheduleService.js";

export const scheduleControllers = createModuleControllers("schedules");

export async function scheduleCalendarController(req, res) {
  try {
    const data = await getScheduleCalendar(req.staff, req.query.month);

    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    const status =
      Number(error.status) >= 400 && Number(error.status) < 500
        ? Number(error.status)
        : 500;

    if (status === 500) {
      console.error("Technician availability:", error);
    }

    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Unable to load technician availability."
          : error.message,
    });
  }
}
