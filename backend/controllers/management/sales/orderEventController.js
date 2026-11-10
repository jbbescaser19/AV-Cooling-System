import {
  listManagementRecords,
  applyManagementEvent,
} from "../../../services/management/operations/operationsService.js";
import { respond } from "../operations/operationsController.js";
export const listManagementOrders = respond(async () => ({
  records: await listManagementRecords("ORDER"),
}));
export const changeManagementOrder = respond(async (req) =>
  applyManagementEvent("ORDER", req.params.orderNumber, req.staff, req.body),
);
