import {
  getMyServicesService,
  changeMyServiceService,
} from "../../../services/customer/profile/serviceService.js";

function sendError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error("customerServiceController:", error);
  }

  return res.status(status).json({
    success: false,
    message:
      status < 500 ? error.message : "Unable to process your service request.",
  });
}

export async function getMyServicesController(req, res) {
  try {
    const services = await getMyServicesService(req.auth.userId);

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

function changeController(action, message) {
  return async (req, res) => {
    try {
      const request = await changeMyServiceService(
        req.auth.userId,
        req.params.requestId,
        action,
        req.body,
      );

      return res.status(200).json({
        success: true,
        message,
        request,
      });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

export const editMyServiceController = changeController(
  "edit",
  "Service details updated.",
);

export const cancelMyServiceController = changeController(
  "cancel",
  "Service request cancelled.",
);

export const deleteMyServiceController = changeController(
  "delete",
  "Cancelled request removed from your history.",
);
