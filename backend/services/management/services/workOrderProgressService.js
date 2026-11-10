import { randomUUID } from "node:crypto";
import { EVENT_LABELS } from "../../../constants/management/fulfillmentEvents.js";
import { operationsModel } from "../../../models/management/operations/operationsModel.js";
import { notificationModel } from "../../../models/customer/notification/notificationModel.js";
import { createCustomerNotification } from "../../customer/notification/notificationService.js";

function conflict(message) {
  throw Object.assign(new Error(message), { status: 409 });
}

/**
 * Keep a technician's Service job and the customer-facing Service Request in sync.
 * Reuses the current transaction: event, status, job and notification all commit
 * or roll back together. Order delivery/payment fulfillment remains separate.
 */
export async function recordServiceJobProgress(
  db,
  work,
  staff,
  nextStatus,
  notes = "",
) {
  if (
    !work.service_request_id ||
    work.work_type !== "SERVICE" ||
    !["IN_PROGRESS", "COMPLETED"].includes(nextStatus)
  )
    return;

  const serviceId = work.service_request_id;
  const model = operationsModel(db);
  const source = await model.lockService(serviceId);
  if (!source) conflict("The linked service request was not found.");
  if (!["CONFIRMED", "COMPLETED"].includes(source.status)) {
    conflict("The linked service request is no longer active.");
  }
  if (nextStatus === "IN_PROGRESS" && source.status !== "CONFIRMED") {
    conflict("A completed service cannot be started again.");
  }

  const schedule = work.scheduledStartLocal
    ? `${work.scheduledStartLocal.replace("T", " ")}:00`
    : null;

  // Existing services may have an assigned job before the scheduling event
  // was recorded. Record missing milestones in their correct order.
  const needed =
    nextStatus === "IN_PROGRESS"
      ? ["SERVICE_SCHEDULED", "SERVICE_STARTED"]
      : ["SERVICE_SCHEDULED", "SERVICE_STARTED", "SERVICE_COMPLETED"];
  const added = [];
  for (const eventCode of needed) {
    if (await model.hasEvent("SERVICE", serviceId, eventCode)) continue;
    await model.addEvent({
      requestKey: randomUUID(),
      kind: "SERVICE",
      recordId: serviceId,
      eventCode,
      staffId: staff.id,
      note: eventCode === "SERVICE_COMPLETED" ? notes.slice(0, 1000) : null,
      schedule: eventCode === "SERVICE_SCHEDULED" ? schedule : null,
    });
    added.push(eventCode);
  }

  if (nextStatus === "COMPLETED" && source.status !== "COMPLETED") {
    await model.setServiceStatus(serviceId, "COMPLETED", null);
  }

  // A Facebook-only service has no registered customer to notify.
  if (
    source.userId &&
    (await notificationModel(db).activeCustomer(source.userId))
  ) {
    const relevant =
      nextStatus === "COMPLETED" ? "SERVICE_COMPLETED" : "SERVICE_STARTED";
    if (added.includes(relevant)) {
      const [title, message] = EVENT_LABELS[relevant];
      await createCustomerNotification(
        db,
        source.userId,
        relevant,
        title,
        message,
        `/account/services/${serviceId}`,
      );
    }
  }
}
