import { getUpcomingAgenda } from "../../../services/management/services/upcomingAgendaService.js";

export async function upcomingAgendaController(req, res) {
  try {
    return res.json({ success: true, ...(await getUpcomingAgenda(req.staff)) });
  } catch (error) {
    const status =
      error?.status >= 400 && error?.status < 500 ? error.status : 500;
    if (status === 500) console.error("Upcoming agenda:", error);
    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Could not load upcoming appointments."
          : error.message,
    });
  }
}
