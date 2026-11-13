import { getWorkHistory } from "../../../services/management/services/workHistoryService.js";
export async function getWorkHistoryController(req, res) {
  try {
    return res.json({
      success: true,
      ...(await getWorkHistory(req.staff, req.params.id)),
    });
  } catch (error) {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Work history:", error);
    return res
      .status(status)
      .json({
        success: false,
        message:
          status === 500 ? "Could not load work history." : error.message,
      });
  }
}
