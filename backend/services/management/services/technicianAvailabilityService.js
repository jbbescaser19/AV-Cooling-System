import connectDB from "../../../utils/dbConn.js";

import { technicianAvailabilityModel } from "../../../models/management/services/technicianAvailabilityModel.js";

import { parseBookingDate } from "../../../validators/scheduling/bookingScheduleValidator.js";

import { fail } from "../workspaceHelpers.js";

export async function getTechnicianAvailability(staff, query) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Management access required.", 403);
  }

  const match =
    /^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(
      String(query.scheduledStart || ""),
    );

  if (!match) {
    fail("Choose an appointment before selecting technicians.", 400);
  }

  const date = parseBookingDate(match[1]);

  const start = `${date} ${match[2]}:${match[3]}:00`;

  const kind = query.kind || "NONE";

  const sourceId = kind === "NONE" ? 0 : Number(query.sourceId);

  if (
    !["NONE", "ORDER", "SERVICE"].includes(kind) ||
    (kind !== "NONE" && (!Number.isSafeInteger(sourceId) || sourceId < 1))
  ) {
    fail("Invalid assignment reference.", 400);
  }

  const rows = await technicianAvailabilityModel(connectDB).list(
    date,
    start,
    kind,
    sourceId,
  );

  return {
    technicians: rows.map((row) => {
      const reason = !Number(row.active)
        ? "Inactive technician or staff account"
        : row.offReason
          ? `Day off / unavailable: ${row.offReason}`
          : Number(row.busy)
            ? "Already assigned during this appointment"
            : "";

      return {
        id: Number(row.id),
        name: row.name,
        available: !reason,
        reason,
      };
    }),
  };
}
