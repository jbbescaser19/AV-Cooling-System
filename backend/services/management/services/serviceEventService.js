import {
  fail,
  requireStatus,
  requirePreviousEvent,
} from "../operations/eventHelpers.js";
export async function transitionService(model, service, data, scheduleSQL) {
  const code = data.eventCode;
  const status = service.status;
  const id = service.id;
  let next = status;
  const has = (event) => model.hasEvent("SERVICE", id, event);
  if (code === "SERVICE_ACCEPTED") {
    requireStatus(status, code, "PENDING");
    next = "CONFIRMED";
  } else if (code === "SERVICE_SCHEDULED") {
    requireStatus(status, code, "CONFIRMED");
    if (await has(code)) {
      fail("Already scheduled. Use reschedule.");
    }
  } else if (code === "SERVICE_RESCHEDULED") {
    requireStatus(status, code, "CONFIRMED");
    // POS walk-in appointments were confirmed when created, without a
    // separate acceptance event. Do not require a nonexistent event.
    const confirmedPos =
      Boolean(service.isPosWalkIn) && Boolean(service.hasAssignedServiceWork);
    if (
      !service.schedule ||
      (!confirmedPos &&
        !(await has("SERVICE_SCHEDULED")) &&
        !(await has("SERVICE_ACCEPTED")))
    ) {
      fail(
        "Confirm a future appointment before rescheduling this service.",
        409,
      );
    }
    if (await has("SERVICE_STARTED")) {
      fail("Service has already started.");
    }
    if (service.schedule === data.schedule) {
      fail("Choose a different appointment time.");
    }
  } else if (code === "SERVICE_STARTED") {
    requireStatus(status, code, "CONFIRMED");
    // POS walk-ins are already CONFIRMED and scheduled at creation time,
    // so they have no SERVICE_ACCEPTED event. A real assigned SERVICE job
    // is the additional proof that this is a confirmed POS appointment.
    const confirmedPos =
      Boolean(service.isPosWalkIn) && Boolean(service.hasAssignedServiceWork);
    if (
      !service.schedule ||
      (!confirmedPos &&
        !(await has("SERVICE_SCHEDULED")) &&
        !(await has("SERVICE_ACCEPTED")))
    ) {
      fail(
        "Confirm an appointment and assign the technician team before starting.",
        409,
      );
    }
    if (await has(code)) {
      fail("Service was already started.");
    }
  } else if (code === "SERVICE_COMPLETED") {
    requireStatus(status, code, "CONFIRMED");
    await requirePreviousEvent(model, "SERVICE", id, "SERVICE_STARTED");
    next = "COMPLETED";
  } else if (code === "SERVICE_DECLINED" || code === "SERVICE_CANCELLED") {
    const allowed =
      code === "SERVICE_DECLINED" ? ["PENDING"] : ["PENDING", "CONFIRMED"];
    requireStatus(status, code, ...allowed);
    if (await has("SERVICE_STARTED")) {
      fail("A started job cannot be cancelled automatically.");
    }
    next = "CANCELLED";
  } else {
    fail("Invalid service event.", 400);
  }
  if (next !== status || scheduleSQL) {
    await model.setServiceStatus(id, next, scheduleSQL);
  }
}
