import connectDB from "../../../utils/dbConn.js";

import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";

import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";

import {
  reserveAppointment,
  releaseAppointment,
} from "../../scheduling/bookingScheduleService.js";

import { operationsModel } from "../../../models/management/operations/operationsModel.js";

import { createCustomerNotification } from "../../customer/notification/notificationService.js";

import {
  EVENT_LABELS,
  scheduleEvents,
  requiredNotes,
  orderEvents,
} from "../../../constants/management/fulfillmentEvents.js";

import { eventSchema } from "../../../validators/management/operations/eventValidator.js";

import { fail, scheduleToSQL, assertStaffRole } from "./eventHelpers.js";

import { transitionOrder } from "../sales/orderEventService.js";

import { transitionService } from "../services/serviceEventService.js";

import { confirmationWorkOrderModel } from "../../../models/management/services/confirmationWorkOrderModel.js";

import {
  ensureConfirmedWorkOrders,
  cancelConfirmedWork,
  validateAssignedTeamSchedule,
} from "../services/confirmationWorkOrderService.js";

export async function listManagementRecords(kind) {
  const model = operationsModel(connectDB);

  if (kind === "ORDER") {
    return model.listOrders();
  }

  if (kind === "SERVICE") {
    return model.listServices();
  }

  fail("Invalid record type.", 400);
}

async function addNotificationForEvent(
  model,
  connection,
  kind,
  record,
  staff,
  data,
  scheduleSQL,
) {
  const [title, description] = EVENT_LABELS[data.eventCode];

  // Only the customer-visible reason is included.
  const visibleNote = data.note ? ` Reason from store: ${data.note}` : "";

  // Confirmation includes the appointment reserved at checkout. Rescheduling
  // uses the newly selected appointment instead of the previous one.
  const savedSchedule =
    kind === "ORDER" && data.eventCode === "ORDER_ACCEPTED"
      ? record.schedule
      : null;
  const effectiveSchedule = data.schedule || savedSchedule;
  const eventScheduleSQL =
    scheduleSQL ||
    (savedSchedule ? `${savedSchedule.replace("T", " ")}:00` : null);
  const dateNote = effectiveSchedule
    ? ` Date/time (Philippines): ${effectiveSchedule.replace("T", " at ")}.`
    : "";

  await model.addEvent({
    requestKey: data.requestKey,
    kind,
    recordId: record.id,
    eventCode: data.eventCode,
    staffId: staff.id,

    // Public/customer-visible reason.
    note: data.note || null,

    // Private; not included in customer notifications.
    internalNote: kind === "SERVICE" ? data.internalNote || null : null,

    schedule: eventScheduleSQL,
  });

  const destination =
    kind === "ORDER"
      ? `/account/orders/${record.reference}`
      : `/account/services/${record.id}`;

  if (record.userId) {
    await createCustomerNotification(
      connection,
      record.userId,
      data.eventCode,
      title,
      `${description}${dateNote}${visibleNote}`,
      destination,
    );
  }
}

export async function applyManagementEvent(kind, reference, staff, rawInput) {
  const parsed = eventSchema.safeParse(rawInput);

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message || "Invalid event details.", 400);
  }

  const data = parsed.data;

  if (kind !== "ORDER" && kind !== "SERVICE") {
    fail("Invalid record type.", 400);
  }

  assertStaffRole(staff, data.eventCode);

  const matchingKind =
    kind === "ORDER"
      ? orderEvents.has(data.eventCode)
      : data.eventCode.startsWith("SERVICE_");

  if (!matchingKind) {
    fail("Event type does not match this record.", 400);
  }

  if (requiredNotes.has(data.eventCode) && data.note.length < 5) {
    fail("Enter a customer-visible reason or note (5+ characters).", 400);
  }

  const isConfirmation = ["ORDER_ACCEPTED", "SERVICE_ACCEPTED"].includes(
    data.eventCode,
  );

  if (data.schedule && !scheduleEvents.has(data.eventCode) && !isConfirmation) {
    fail("This event does not accept a schedule.", 400);
  }

  if (
    data.technicianIds.length &&
    !["ORDER_ACCEPTED", "SERVICE_ACCEPTED"].includes(data.eventCode)
  ) {
    fail("Technicians can only be selected during confirmation.", 400);
  }

  const scheduleSQL = scheduleEvents.has(data.eventCode)
    ? scheduleToSQL(data.schedule)
    : isConfirmation && data.schedule
      ? scheduleToSQL(data.schedule)
      : null;

  if (kind === "SERVICE" && !/^[1-9]\d*$/.test(String(reference))) {
    fail("Invalid service request ID.", 400);
  }

  if (kind === "ORDER" && !/^AV-[0-9A-F]{32}$/.test(String(reference))) {
    fail("Invalid online order number.", 400);
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = operationsModel(connection);

    const record =
      kind === "ORDER"
        ? await model.lockOrder(reference)
        : await model.lockService(reference);

    if (!record) {
      fail("Record not found.", 404);
    }

    const prior = await model.findEventByRequestKey(data.requestKey);

    if (prior) {
      if (
        prior.kind !== kind ||
        Number(prior.recordId) !== Number(record.id) ||
        prior.eventCode !== data.eventCode
      ) {
        fail("Request reference already used for a different event.");
      }

      await connection.commit();

      return {
        alreadyRecorded: true,
      };
    }

    // Field work must be assigned before it can start.
    const jobModel = confirmationWorkOrderModel(connection);

    const workMilestones = {
      SERVICE_STARTED: ["SERVICE", "IN_PROGRESS"],
      SERVICE_COMPLETED: ["SERVICE", "COMPLETED"],
      ORDER_OUT_FOR_DELIVERY: ["DELIVERY", "IN_PROGRESS"],
      ORDER_DELIVERED: ["DELIVERY", "COMPLETED"],
      INSTALLATION_STARTED: ["INSTALLATION", "IN_PROGRESS"],
      INSTALLATION_COMPLETED: ["INSTALLATION", "COMPLETED"],
    };

    // Confirm the customer's existing appointment, not a staff-selected replacement.
    // Keep this in the same transaction as the order and field work.
    if (kind === "ORDER" && data.eventCode === "ORDER_ACCEPTED") {
      const source = await jobModel.orderSource(record.id);
      const fieldWorkRequired =
        source?.fulfillment === "DELIVERY" ||
        Boolean(source?.installationIncluded);
      if (fieldWorkRequired && !record.schedule) {
        fail(
          "This order has no saved appointment. Arrange a valid slot before confirming.",
        );
      }
      if (record.schedule) {
        await reserveAppointment(
          connection,
          "ORDER",
          record.id,
          record.schedule,
        );
      }
    }

    if (kind === "ORDER" && data.eventCode === "SCHEDULE_CHANGED") {
      // A booked appointment can move before acceptance, or after acceptance
      // only while related field jobs have not started. Keep both job schedules
      // aligned with the replacement reservation.
      const jobs = await jobModel.workForSource("ORDER", record.id);
      if (jobs.some((job) => !["PENDING", "ASSIGNED"].includes(job.status))) {
        fail(
          "Delivery or installation has started. The appointment cannot be changed.",
        );
      }
      await validateAssignedTeamSchedule(
        connection,
        { order_id: record.id },
        data.schedule,
      );
    }

    const milestone = workMilestones[data.eventCode];

    const fieldOrder =
      milestone && kind === "ORDER"
        ? await jobModel.orderSource(record.id)
        : null;

    const requiresFieldTeam =
      milestone &&
      (kind === "SERVICE" ||
        (milestone[0] === "DELIVERY" &&
          fieldOrder?.fulfillment === "DELIVERY") ||
        (milestone[0] === "INSTALLATION" &&
          Boolean(fieldOrder?.installationIncluded)));

    if (requiresFieldTeam && milestone[1] === "IN_PROGRESS") {
      await jobModel.checkReadyForStart(kind, record.id, milestone[0]);
    }

    if (kind === "ORDER") {
      await transitionOrder(
        model,
        connection,
        record,
        data,
        staff.id,
        scheduleSQL,
      );
    } else {
      await transitionService(model, record, data, scheduleSQL);
    }

    if (requiresFieldTeam) {
      await jobModel.advanceJobFromEvent(
        kind,
        record.id,
        milestone[0],
        milestone[1],
        staff.id,
        `Job ${milestone[1].toLowerCase().replaceAll("_", " ")} from ${data.eventCode}`,
      );
    }

    if (scheduleSQL) {
      await reserveAppointment(connection, kind, record.id, data.schedule);

      if (
        [
          "INSTALLATION_SCHEDULED",
          "SCHEDULE_CHANGED",
          "SERVICE_SCHEDULED",
          "SERVICE_RESCHEDULED",
        ].includes(data.eventCode)
      ) {
        await confirmationWorkOrderModel(connection).rescheduleUnstarted(
          kind,
          record.id,
          data.schedule,
        );
      }
    }

    let workOrders = [];

    if (["ORDER_ACCEPTED", "SERVICE_ACCEPTED"].includes(data.eventCode)) {
      workOrders = await ensureConfirmedWorkOrders(
        connection,
        kind,
        record.id,
        staff,
        data.technicianIds,
      );
    }

    if (
      [
        "ORDER_DECLINED",
        "ORDER_CANCELLED_BY_STAFF",
        "SERVICE_DECLINED",
        "SERVICE_CANCELLED",
      ].includes(data.eventCode)
    ) {
      await cancelConfirmedWork(connection, kind, record.id);

      if (kind === "SERVICE") {
        const paymentModel = servicePaymentModel(connection);

        if (
          (await paymentModel.paymentStatusForCancellation(record.id)) ===
          "PAID"
        ) {
          fail(
            "This service has a recorded payment. Handle the refund before cancelling.",
            409,
          );
        }

        await paymentModel.cancelPending(record.id);
      }

      await releaseAppointment(connection, kind, record.id);
    }

    await addNotificationForEvent(
      model,
      connection,
      kind,
      record,
      staff,
      data,
      scheduleSQL,
    );

    // Record the action in the same transaction.
    // This ensures failed updates do not leave a false audit entry.
    if (kind === "SERVICE" || data.eventCode === "PAYMENT_CONFIRMED") {
      await auditLogModel(connection).audit(
        staff.id,
        data.eventCode === "PAYMENT_CONFIRMED"
          ? "CONFIRM_ORDER_CASH"
          : data.eventCode,
        kind === "SERVICE" ? "service-requests" : "orders",
        record.id,
      );
    }

    await connection.commit();

    return {
      alreadyRecorded: false,
      workOrders,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Management and assigned-technician activity access.
 * The customer API does not expose internalNote.
 */
export async function getManagementServiceActivity(staff, rawId) {
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid service ID.", 400);
  }

  if (
    !staff?.id ||
    !["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"].includes(staff.role)
  ) {
    fail("Management access required.", 403);
  }

  const model = operationsModel(connectDB);

  if (!(await model.serviceExists(id))) {
    fail("Service not found.", 404);
  }

  if (
    staff.role === "TECHNICIAN" &&
    !(await model.technicianAssignedToService(staff.id, id))
  ) {
    fail("Only assigned technicians may see these notes.", 403);
  }

  return model.serviceActivity(id);
}
