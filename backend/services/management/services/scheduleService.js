import { fail, validDate } from "../workspaceHelpers.js";

const overlaps = (aStart, aEnd, bStart, bEnd) => {
  if (!aStart || !aEnd || !bStart || !bEnd) return true; // full-day blocks
  return aStart < bEnd && bStart < aEnd;
};

async function validateBlock(model, techId, date, data, ignoreId = null) {
  validDate(date);
  const [tech] = await model.lockTechnician(techId);
  if (!tech) fail("Technician not found.", 404);
  const others = await model.dayRecords(techId, date);
  for (const block of others) {
    if (Number(block.id) === Number(ignoreId)) continue;
    if (data.status === "AVAILABLE" || block.status === "AVAILABLE") {
      fail(
        "An availability entry already exists for this date. Edit or remove it first.",
        409,
      );
    }
    if (
      overlaps(data.startTime, data.endTime, block.startTime, block.endTime)
    ) {
      fail("An unavailable period already overlaps that date and time.", 409);
    }
  }
  if (
    data.status === "OFF" &&
    (await model.busyAssignedJob(techId, date, data.startTime, data.endTime))
      .length
  ) {
    fail(
      "This technician already has a job during that period. Reassign or reschedule the job first.",
      409,
    );
  }
}

export async function createSchedules(model, staff, data) {
  await validateBlock(model, data.technicianId, data.date, data);
  const result = await model.createSchedule(
    data.technicianId,
    data.date,
    data.status,
    data.reason,
    data.startTime,
    data.endTime,
  );
  return result.insertId;
}
export async function updateSchedules(model, staff, id, data) {
  if (staff.role === "TECHNICIAN")
    fail("A manager must change technician availability.", 403);
  const [old] = await model.lockSchedule(id);
  if (!old) fail("Schedule not found.", 404);
  await validateBlock(model, old.technicianId, old.date, data, id);
  const result = await model.updateSchedule(
    id,
    data.status,
    data.reason,
    data.startTime,
    data.endTime,
  );
  return { result, converted: null };
}
