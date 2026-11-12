import { getServicePaymentDetails } from "../../../services/management/sales/servicePaymentService.js";

import {
  listManagementRecords,
  applyManagementEvent,
  getManagementServiceActivity,
} from "../../../services/management/operations/operationsService.js";

import { respond } from "../operations/operationsController.js";

export const listManagementServices = respond(async () => ({
  records: await listManagementRecords("SERVICE"),
}));

export const changeManagementService = respond(async (req) =>
  applyManagementEvent("SERVICE", req.params.requestId, req.staff, req.body),
);

export const listServiceActivityController = respond(async (req) => ({
  events: await getManagementServiceActivity(req.staff, req.params.requestId),
}));

export const getManagementServicePayment = respond(async (req) => ({
  payment: await getServicePaymentDetails(req.staff, req.params.requestId),
}));
