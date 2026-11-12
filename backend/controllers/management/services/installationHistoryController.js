import { listCompletedInstallations } from "../../../services/management/services/installationHistoryService.js";
import { handle } from "../sales/salesControllerHelpers.js";

export const completedInstallationsController = handle((req) =>
  listCompletedInstallations(req.staff, req.query),
);
