import { randomUUID } from "node:crypto";
import { BOOKING_SLOTS } from "../../validators/scheduling/bookingScheduleValidator.js";
import { bookingScheduleModel } from "../../models/scheduling/bookingScheduleModel.js";
import { confirmationWorkOrderModel } from "../../models/management/services/confirmationWorkOrderModel.js";
import { fulfillmentEventModel } from "../../models/management/operations/fulfillmentEventModel.js";
import { notificationModel } from "../../models/customer/notification/notificationModel.js";
import { createCustomerNotification } from "../customer/notification/notificationService.js";
import {
  reserveAppointment,
  releaseAppointment,
} from "./bookingScheduleService.js";

const conflict = (message) => {
  throw Object.assign(new Error(message), { status: 409 });
};

export async function moveEarlyAppointment(db, kind, id, staff) {
  if (!id) return null;

  const calendar = bookingScheduleModel(db);
  const source = await calendar.sourceState(kind, id);

  if (!source?.schedule) return null;

  const now = Date.now();
  const original = source.schedule;

  if (Date.parse(`${original}:00+08:00`) <= now) {
    return null;
  }

  const actual = new Date(now + 8 * 3600000).toISOString().slice(0, 16);

  const today = actual.slice(0, 10);
  const time = actual.slice(11, 16);

  const minutes = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

  const current = BOOKING_SLOTS.find(
    (slot) => slot.start <= time && time < slot.end,
  );

  const overlapping = BOOKING_SLOTS.find(
    (slot) =>
      minutes(slot.start) > minutes(time) &&
      minutes(slot.start) < minutes(time) + 120,
  );

  const affectedSlot = current || overlapping;

  const jobs = confirmationWorkOrderModel(db);
  const related = await jobs.workForSource(kind, id);

  if (!related.length) {
    conflict("This appointment has no assigned work.");
  }

  if (related.some((job) => job.status === "IN_PROGRESS")) {
    return null;
  }

  const team = await jobs.technicianIdsForSource(kind, id);

  if (!team.length) {
    conflict("Assign a technician team before starting early.");
  }

  for (const technicianId of [...team].sort((a, b) => a - b)) {
    if (!(await jobs.lockActiveTechnician(technicianId))) {
      conflict(`Technician #${technicianId} is inactive.`);
    }

    if (await jobs.technicianIsOff(technicianId, actual)) {
      conflict(
        `Technician #${technicianId} is off during the proposed work time.`,
      );
    }

    if (await calendar.technicianWorkingElsewhere(technicianId, kind, id)) {
      conflict(
        `Technician #${technicianId} has another job in progress. Complete that job before starting this one.`,
      );
    }

    if (await jobs.technicianBusyOnOtherJob(technicianId, actual, kind, id)) {
      conflict(
        `Technician #${technicianId} has another appointment overlapping the next two hours. Choose another available team or start at the scheduled time.`,
      );
    }
  }

  if (affectedSlot) {
    await reserveAppointment(db, kind, id, `${today}T${affectedSlot.start}`, {
      confirmed: true,
      allowCurrent: true,
    });
  } else {
    await releaseAppointment(db, kind, id);
  }

  const sql = `${actual.replace("T", " ")}:00`;

  await calendar.syncSourceDate(kind, id, sql);
  await jobs.rescheduleUnstarted(kind, id, actual);

  const note =
    `Appointment moved earlier from ${original.replace("T", " ")} ` +
    `to ${actual.replace("T", " ")}.`;

  for (const job of related.filter((item) =>
    ["PENDING", "ASSIGNED"].includes(item.status),
  )) {
    await jobs.history(job.id, job.status, job.status, staff.id, note);
  }

  const eventCode =
    kind === "ORDER" ? "SCHEDULE_CHANGED" : "SERVICE_RESCHEDULED";

  await fulfillmentEventModel(db).addEvent({
    requestKey: randomUUID(),
    kind,
    recordId: id,
    eventCode,
    staffId: staff.id,
    note,
    schedule: sql,
  });

  if (
    source.userId &&
    (await notificationModel(db).activeCustomer(source.userId))
  ) {
    await createCustomerNotification(
      db,
      source.userId,
      eventCode,
      "Appointment moved earlier",
      note,
      kind === "ORDER"
        ? `/account/orders/${source.reference}`
        : `/account/services/${id}`,
    );
  }

  return actual;
}

export async function releaseCompletedAppointment(db, kind, id) {
  if (!id) return;

  const jobs = await confirmationWorkOrderModel(db).workForSource(kind, id);

  if (jobs.length && jobs.every((job) => job.status === "COMPLETED")) {
    await releaseAppointment(db, kind, id);
  }
}
