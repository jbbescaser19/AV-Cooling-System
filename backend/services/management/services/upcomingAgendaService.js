import connectDB from "../../../utils/dbConn.js";
import { upcomingAgendaModel } from "../../../models/management/services/upcomingAgendaModel.js";

/** Personal for technicians; business-wide read-only schedule for staff managers. */
export async function getUpcomingAgenda(staff) {
  const role = String(staff?.role || "");
  const id = Number(staff?.id);
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"].includes(role)
  ) {
    throw Object.assign(new Error("Schedule access denied."), { status: 403 });
  }
  const model = upcomingAgendaModel(connectDB);
  const technicianOnly = role === "TECHNICIAN";
  const [jobs, unavailable] = await Promise.all([
    model.upcomingJobs(id, technicianOnly),
    technicianOnly
      ? model.upcomingUnavailabilityForTechnician(id)
      : Promise.resolve([]),
  ]);
  return {
    agenda: [
      ...jobs.map((job) => ({ ...job, kind: "JOB" })),
      ...unavailable.map((item) => ({
        ...item,
        kind: "UNAVAILABLE",
        type: "OFF",
      })),
    ]
      .sort((a, b) =>
        String(a.scheduledStart).localeCompare(String(b.scheduledStart)),
      )
      .slice(0, 60),
  };
}
