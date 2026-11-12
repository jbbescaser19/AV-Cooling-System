import { confirmationWorkOrderModel } from "../../../models/management/services/confirmationWorkOrderModel.js";
import { parseBookingStart } from "../../../validators/scheduling/bookingScheduleValidator.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

/** Shared transaction-aware helper. Caller owns COMMIT/ROLLBACK. */
export async function ensureConfirmedWorkOrders(
  db,
  kind,
  sourceId,
  staff,
  technicianIds = [],
) {
  const model = confirmationWorkOrderModel(db);
  const source =
    kind === "ORDER"
      ? await model.orderSource(sourceId)
      : await model.serviceSource(sourceId);
  if (
    !source ||
    !["CONFIRMED", "SCHEDULED", "IN_PROGRESS"].includes(source.status)
  ) {
    fail("Confirm the order or service before assigning field work.");
  }
  const types =
    kind === "SERVICE"
      ? ["SERVICE"]
      : source.channel === "POS"
        ? source.fulfillment === "DELIVERY"
          ? [
              "DELIVERY",
              ...(source.installationIncluded ? ["INSTALLATION"] : []),
            ]
          : []
        : [
            ...(source.fulfillment === "DELIVERY" ? ["DELIVERY"] : []),
            ...(source.installationIncluded ? ["INSTALLATION"] : []),
          ];
  if (!types.length) {
    if (technicianIds.length)
      fail("This pickup-only order does not require field work.", 400);
    return [];
  }
  if (!source.schedule) {
    fail("Select an appointment before confirming and assigning this job.");
  }
  // Old imported bookings may use arbitrary times. New assignments use the shared slots.
  const { date } = parseBookingStart(source.schedule);
  const ids = [...new Set(technicianIds)];
  if (ids.length !== technicianIds.length)
    fail("Select each technician only once.", 400);

  // Lock technicians in a stable order before checking conflicts. Concurrent
  // confirmations assigning the same technician cannot both pass validation.
  for (const id of [...ids].sort((a, b) => a - b)) {
    if (!(await model.lockActiveTechnician(id)))
      fail("An assigned technician is no longer active. Refresh and retry.");
    if (await model.technicianIsOff(id, source.schedule))
      fail("A selected technician is off on that date.");
    if (
      await model.technicianBusyOnOtherJob(id, source.schedule, kind, sourceId)
    ) {
      fail(
        "A selected technician already has work booked for that day. Choose another.",
      );
    }
  }

  const results = [];
  for (const type of types) {
    let work = await model.activeWork(kind, sourceId, type);
    if (!work) {
      const id = await model.createWork(kind, source, type, source.schedule);
      await model.history(
        id,
        null,
        "PENDING",
        staff.id,
        "Work order automatically created upon confirmation",
      );
      work = { id, status: "PENDING" };
    }
    if (ids.length) {
      if (!["PENDING", "ASSIGNED"].includes(work.status)) {
        fail("Cannot change technicians for work already in progress.");
      }
      for (const techId of ids) {
        if (!(await model.alreadyAssigned(work.id, techId))) {
          await model.assign(work.id, techId, staff.id);
        }
      }
      if (work.status === "PENDING") {
        await model.markAssigned(work.id);
        await model.history(
          work.id,
          "PENDING",
          "ASSIGNED",
          staff.id,
          "Technicians assigned during confirmation",
        );
      }
    }
    results.push({ id: work.id, type });
  }
  return results;
}

/** For existing Facebook-converted jobs (already created during conversion). */
export async function assignConfirmedExistingWork(
  db,
  kind,
  sourceId,
  staff,
  technicianIds,
) {
  return ensureConfirmedWorkOrders(db, kind, sourceId, staff, technicianIds);
}

export async function cancelConfirmedWork(db, kind, sourceId) {
  await confirmationWorkOrderModel(db).cancelUnstarted(kind, sourceId);
}

/** Change the people assigned to a pending/assigned job without a separate team table. */
export async function reassignWorkOrderTeam(db, work, staff, technicianIds) {
  if (!["OWNER", "MANAGER"].includes(staff.role))
    fail("Only management can assign jobs.", 403);
  if (!technicianIds.length) fail("Select at least one technician.", 400);
  if (new Set(technicianIds).size !== technicianIds.length)
    fail("Select each technician only once.", 400);

  const kind = work.order_id ? "ORDER" : "SERVICE";
  const sourceId = work.order_id || work.service_request_id;
  if (!sourceId || !work.scheduledStartLocal)
    fail("This work order is missing its linked appointment.");
  const model = confirmationWorkOrderModel(db);

  // Delivery + installation are two status milestones, NOT two crews.
  // Lock both before editing either. Any in-progress/completed milestone
  // freezes reassignment to avoid changing the team halfway through the job.
  const sourceJobs =
    kind === "ORDER" ? await model.workForSource(kind, sourceId) : [];
  const isCombined =
    sourceJobs.some((j) => j.type === "DELIVERY") &&
    sourceJobs.some((j) => j.type === "INSTALLATION");
  const jobs = isCombined
    ? sourceJobs.filter((j) => ["DELIVERY", "INSTALLATION"].includes(j.type))
    : [{ id: work.work_order_id, status: work.status }];

  if (jobs.some((job) => !["PENDING", "ASSIGNED"].includes(job.status)))
    fail("A started or completed job's team cannot be changed.");

  for (const id of [...technicianIds].sort((a, b) => a - b)) {
    if (!(await model.lockActiveTechnician(id)))
      fail("An assigned technician is no longer active.");
    if (await model.technicianIsOff(id, work.scheduledStartLocal))
      fail("A selected technician is off that day.");
    if (
      await model.technicianBusyOnOtherJob(
        id,
        work.scheduledStartLocal,
        kind,
        sourceId,
      )
    )
      fail("A selected technician has work booked that day.");
  }

  for (const job of jobs) {
    await model.cancelAssignments(job.id);
    // Preserve the chosen first member as the Team Leader.
    for (const id of technicianIds) await model.assign(job.id, id, staff.id);
    if (job.status === "PENDING") await model.markAssigned(job.id);
    await model.history(
      job.id,
      job.status,
      "ASSIGNED",
      staff.id,
      isCombined
        ? "Shared delivery and installation crew updated"
        : "Technician team updated",
    );
  }
}

/** Validate every assigned worker when rescheduling a shared appointment. */
export async function validateAssignedTeamSchedule(db, work, value) {
  const kind = work.order_id ? "ORDER" : "SERVICE";
  const sourceId = work.order_id || work.service_request_id;
  if (!sourceId) return;
  parseBookingStart(value);
  const model = confirmationWorkOrderModel(db);
  const ids = await model.technicianIdsForSource(kind, sourceId);
  for (const id of ids) {
    if (!(await model.lockActiveTechnician(id)))
      fail("An assigned technician is no longer active.");
    if (await model.technicianIsOff(id, value))
      fail("A technician is unavailable during the proposed time.");
    if (await model.technicianBusyOnOtherJob(id, value, kind, sourceId)) {
      fail("A technician is booked for another job on the proposed day.");
    }
  }
}
