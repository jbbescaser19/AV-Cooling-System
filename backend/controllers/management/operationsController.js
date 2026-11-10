import {
  applyManagementEvent,
  listManagementRecords,
} from "../../services/management/operationsService.js";

function respond(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      res.json({ success: true, ...result });
    } catch (error) {
      const status =
        error.status >= 400 && error.status < 500 ? error.status : 500;
      if (status === 500) console.error("Management operations:", error);
      res
        .status(status)
        .json({
          success: false,
          message:
            status === 500 ? "Unable to update this record." : error.message,
        });
    }
  };
}

export const listManagementOrders = respond(async () => ({
  records: await listManagementRecords("ORDER"),
}));
export const listManagementServices = respond(async () => ({
  records: await listManagementRecords("SERVICE"),
}));
export const changeManagementOrder = respond(async (req) =>
  applyManagementEvent("ORDER", req.params.orderNumber, req.staff, req.body),
);
export const changeManagementService = respond(async (req) =>
  applyManagementEvent("SERVICE", req.params.requestId, req.staff, req.body),
);
