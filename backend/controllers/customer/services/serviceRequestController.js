import {
  createServiceRequestService,
  getActiveServiceTypesService,
  getCustomerServiceRequestsService,
} from "../../../services/customer/services/serviceRequestService.js";

function sendError(res, error, action) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(`serviceRequestController - ${action}:`, error);
  }

  return res.status(status).json({
    success: false,
    message:
      status < 500 ? error.message : "Unable to process your service request.",
  });
}

export async function getActiveServiceTypesController(req, res) {
  try {
    const services = await getActiveServiceTypesService();

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    return sendError(res, error, "getActiveServices");
  }
}

export async function createServiceRequestController(req, res) {
  try {
    const request = await createServiceRequestService(
      req.auth.userId,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message:
        "Service request submitted. Schedule and final price are subject to approval.",
      request,
    });
  } catch (error) {
    return sendError(res, error, "createRequest");
  }
}

export async function getCustomerServiceRequestsController(req, res) {
  try {
    const requests = await getCustomerServiceRequestsService(req.auth.userId);

    return res.status(200).json({
      success: true,
      requests,
    });
  } catch (error) {
    return sendError(res, error, "getRequests");
  }
}
