import connectDB from "../../../utils/dbConn.js";
import { workHistoryModel } from "../../../models/management/services/workHistoryModel.js";
export async function getWorkHistory(staff, rawId) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1)
    throw Object.assign(new Error("Invalid work order ID."), { status: 400 });
  if (!staff?.id || !["OWNER", "MANAGER", "TECHNICIAN"].includes(staff.role)) {
    throw Object.assign(new Error("Management access required."), {
      status: 403,
    });
  }
  const model = workHistoryModel(connectDB);
  const record = await model.record(id);
  if (!record)
    throw Object.assign(new Error("Work order not found."), { status: 404 });
  if (
    staff.role === "TECHNICIAN" &&
    !(await model.isTechnicianAssigned(id, staff.id))
  ) {
    throw Object.assign(
      new Error("Only assigned technicians can view this job's history."),
      { status: 403 },
    );
  }
  return { record, events: await model.events(id) };
}
