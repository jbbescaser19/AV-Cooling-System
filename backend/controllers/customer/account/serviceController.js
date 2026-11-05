import { getMyServicesService } from "../../../services/customer/profile/serviceService.js";

export async function getMyServicesController(req, res) {
  try {
    const services = await getMyServicesService(req.auth.userId);

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    const status = error.status || 500;

    if (status >= 500) {
      console.error("customerServiceController - getMyServices:", error);
    }

    return res.status(status).json({
      success: false,
      message:
        status < 500 ? error.message : "Unable to load your service requests.",
    });
  }
}
