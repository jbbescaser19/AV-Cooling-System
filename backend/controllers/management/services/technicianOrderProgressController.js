import { changeTechnicianOrderProgress } from "../../../services/management/services/technicianOrderProgressService.js";

export async function updateTechnicianOrderProgress(req, res) {
  try {
    const result = await changeTechnicianOrderProgress(
      req.staff,
      req.params.orderId,
      req.body,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    const status =
      Number(error.status) >= 400 && Number(error.status) < 500
        ? Number(error.status)
        : 500;
    if (status === 500) console.error("Technician order progress:", error);
    res.status(status).json({
      success: false,
      message:
        status === 500 ? "Could not update order progress." : error.message,
    });
  }
}
