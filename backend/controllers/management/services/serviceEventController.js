import {
  listManagementRecords,
  applyManagementEvent,
} from "../../../services/management/operations/operationsService.js";
import { respond } from "../operations/operationsController.js";
export const listManagementServices = respond(async () => ({
  records: await listManagementRecords("SERVICE"),
}));
export const changeManagementService = respond(async (req) =>
  applyManagementEvent("SERVICE", req.params.requestId, req.staff, req.body),
);
