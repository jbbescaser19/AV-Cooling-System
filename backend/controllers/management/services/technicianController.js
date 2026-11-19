import { createModuleControllers } from "../workspaceController.js";

import { getTechnicianAvailability } from "../../../services/management/services/technicianAvailabilityService.js";

export const technicianControllers = createModuleControllers("technicians");

export async function technicianAvailabilityController(req, res) {
  try {
    const data = await getTechnicianAvailability(req.staff, req.query);

    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;

    if (status === 500) {
      console.error("Technician availability:", error);
    }

    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Unable to verify technician availability."
          : error.message,
    });
  }
}
