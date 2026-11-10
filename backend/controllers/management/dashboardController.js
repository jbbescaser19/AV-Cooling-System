import { getManagementDashboard } from "../../services/management/dashboardService.js";

export async function getManagementDashboardController(req, res) {
  try {
    const result = await getManagementDashboard(req.staff);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Management dashboard:", error);
    return res.status(status).json({
      success: false,
      message:
        status === 500 ? "Unable to load dashboard data." : error.message,
    });
  }
}
