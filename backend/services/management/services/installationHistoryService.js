import connectDB from "../../../utils/dbConn.js";
import { installationHistoryModel } from "../../../models/management/services/installationHistoryModel.js";
import { validateCompletedJobsHistoryQuery } from "../../../validators/management/services/completedJobsHistoryValidator.js";

export async function listCompletedInstallations(staff, query) {
  if (
    !staff?.id ||
    !["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff.role)
  ) {
    throw Object.assign(new Error("Management access required."), {
      status: 403,
    });
  }
  const filters = validateCompletedJobsHistoryQuery(query);
  return installationHistoryModel(connectDB).completedInstallations(filters);
}
