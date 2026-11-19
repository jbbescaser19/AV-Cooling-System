import {
  moveEarlyAppointment,
  releaseCompletedAppointment,
} from "../../scheduling/appointmentLifecycleService.js";

import {
  reassignWorkOrderTeam,
  validateAssignedTeamSchedule,
} from "./confirmationWorkOrderService.js";

import { ensureOrderStockDispatched } from "../../customer/order/stockReservationService.js";
import { recordServiceJobProgress } from "./workOrderProgressService.js";
import { fail, localSQL, verifyTechnician } from "../workspaceHelpers.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { bookingScheduleModel } from "../../../models/scheduling/bookingScheduleModel.js";

export async function createWorkOrders(model, staff, data, connection) {
  const scheduledStart = localSQL(data.scheduledStart);

  const source = (
    data.sourceType === "ORDER"
      ? await model.findOrder(data.sourceId)
      : await model.findServiceRequest(data.sourceId)
  )[0];

  if (
    !source ||
    !["CONFIRMED", "SCHEDULED", "IN_PROGRESS"].includes(source.status)
  ) {
    fail("Select a confirmed, active source order or service request.", 409);
  }

  if (data.sourceType === "ORDER" && data.workType === "SERVICE") {
    fail("Product orders require DELIVERY or INSTALLATION work.", 409);
  }

  if (data.sourceType === "SERVICE_REQUEST" && data.workType !== "SERVICE") {
    fail("Service requests require SERVICE work.", 409);
  }

  if (
    (
      await model.existingWorkSource(
        data.sourceType,
        data.sourceId,
        data.workType,
      )
    )[0]
  ) {
    fail("This source already has an active work order of this type.", 409);
  }

  if (data.technicianId) {
    await verifyTechnician(model, data.technicianId, data.scheduledStart);
  }

  const kind = data.sourceType === "ORDER" ? "ORDER" : "SERVICE";

  await reserveAppointment(
    connection,
    kind,
    data.sourceId,
    data.scheduledStart,
  );

  await bookingScheduleModel(connection).syncSourceDate(
    kind,
    data.sourceId,
    scheduledStart,
  );

  await model.rescheduleRelatedWorkOrders(kind, data.sourceId, scheduledStart);

  const newWork = await model.createWork({
    orderId: data.sourceType === "ORDER" ? data.sourceId : null,

    serviceRequestId:
      data.sourceType === "SERVICE_REQUEST" ? data.sourceId : null,

    workType: data.workType,
    scheduledStart,
    customer: source.customer,
    phone: source.phone,
    address: source.address,
  });

  const created = newWork.insertId;

  await model.addWorkHistory(
    created,
    null,
    "PENDING",
    staff.id,
    "Work order created",
  );

  if (data.technicianId) {
    await model.assignTechnician(created, data.technicianId, staff.id);

    await model.updateWork(created, "ASSIGNED", "");

    await model.addWorkHistory(
      created,
      "PENDING",
      "ASSIGNED",
      staff.id,
      "Technician assigned",
    );
  }

  return created;
}

export async function updateWorkOrders(
  model,
  staff,
  id,
  data,
  connection,
  options = {},
) {
  let result;
  const converted = null;

  const work = (await model.lockWork(id))[0];

  if (!work) {
    fail("Work order not found.", 404);
  }

  if (
    staff.role === "TECHNICIAN" &&
    !(await model.assignedToStaff(id, staff.id))[0]
  ) {
    fail("This job is not assigned to you.", 403);
  }

  if (
    staff.role === "TECHNICIAN" &&
    !["IN_PROGRESS", "COMPLETED"].includes(data.status)
  ) {
    fail(
      "Technicians can only start or complete their own assigned jobs.",
      403,
    );
  }

  if (
    ["IN_PROGRESS", "COMPLETED"].includes(data.status) &&
    (work.status === data.status ||
      (data.status === "IN_PROGRESS" && work.status === "COMPLETED"))
  ) {
    return {
      result: { affectedRows: 1 },
      converted,
      alreadyRecorded: true,
    };
  }

  if (
    work.order_id &&
    ["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(data.status) &&
    !options.coordinatedOrderProgress
  ) {
    const order = await model.orderFulfillmentState(work.order_id);

    if (order?.channel === "ONLINE") {
      fail(
        "Use My Jobs for Start/Complete Service or Delivery. To cancel the whole order, use Orders before field work begins. Individual online work-order changes would leave job stages, stock, and order history out of sync.",
        409,
      );
    }
  }

  const transitions = {
    PENDING: ["ASSIGNED", "CANCELLED", "RESCHEDULE"],

    ASSIGNED: ["REASSIGN", "IN_PROGRESS", "CANCELLED", "RESCHEDULE"],

    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!transitions[work.status]?.includes(data.status)) {
    fail(`Cannot change ${work.status} to ${data.status}.`, 409);
  }

  if (
    data.status === "IN_PROGRESS" &&
    !(await model.hasActiveAssignedTeam(id))
  ) {
    fail("Assign an active technician team before starting this job.", 409);
  }

  if (data.status === "COMPLETED" && data.notes.length < 5) {
    fail("Completion notes must be at least 5 characters.");
  }

  if (
    ["ASSIGNED", "REASSIGN"].includes(data.status) &&
    data.technicianIds.length
  ) {
    await reassignWorkOrderTeam(connection, work, staff, data.technicianIds);

    return {
      result: { affectedRows: 1 },
      converted,
    };
  }

  if (data.status === "REASSIGN") {
    fail("Select technicians to assign.");
  }

  const oldAssignment = (await model.getWorkAssignment(id))[0];

  if (data.status === "ASSIGNED") {
    if (staff.role === "TECHNICIAN") {
      fail("Only management can assign new jobs.", 403);
    }

    if (!data.technicianId || oldAssignment) {
      fail("Choose an available technician for this unassigned job.", 409);
    }

    const day = data.scheduledStart || work.scheduledStartLocal;

    await verifyTechnician(model, data.technicianId, day, id);

    if (work.order_id) {
      await reassignWorkOrderTeam(connection, work, staff, [data.technicianId]);

      return {
        result: { affectedRows: 1 },
        converted,
      };
    }

    await model.assignTechnician(id, data.technicianId, staff.id);
  }

  if (data.status === "RESCHEDULE") {
    if (staff.role === "TECHNICIAN") {
      fail("Only management may reschedule jobs.", 403);
    }

    if (!data.scheduledStart) {
      fail("Choose the new appointment date and time.");
    }

    const sqlDate = localSQL(data.scheduledStart);

    if (work.order_id || work.service_request_id) {
      await validateAssignedTeamSchedule(connection, work, data.scheduledStart);
    } else if (oldAssignment) {
      await verifyTechnician(
        model,
        oldAssignment.technicianId,
        data.scheduledStart,
        id,
      );
    }

    const kind = work.order_id ? "ORDER" : "SERVICE";

    const sourceId = work.order_id || work.service_request_id;

    if (sourceId) {
      await reserveAppointment(connection, kind, sourceId, data.scheduledStart);

      await bookingScheduleModel(connection).syncSourceDate(
        kind,
        sourceId,
        sqlDate,
      );

      await model.rescheduleRelatedWorkOrders(kind, sourceId, sqlDate);
    } else {
      await model.rescheduleWork(id, sqlDate);
    }

    await model.addWorkHistory(
      id,
      work.status,
      work.status,
      staff.id,
      `Rescheduled for ${sqlDate}. ${data.notes}`,
    );

    return {
      result: { affectedRows: 1 },
      converted,
    };
  }

  const appointmentKind = work.order_id ? "ORDER" : "SERVICE";

  const appointmentId = work.order_id || work.service_request_id;

  if (data.status === "IN_PROGRESS" && appointmentId) {
    const moved = await moveEarlyAppointment(
      connection,
      appointmentKind,
      appointmentId,
      staff,
    );

    if (moved) {
      work.scheduledStartLocal = moved;
    }
  }

  if (work.order_id && ["IN_PROGRESS", "COMPLETED"].includes(data.status)) {
    const state = await model.orderFulfillmentState(work.order_id);

    if (
      state?.channel === "POS" &&
      state.paymentStatus !== "PAID" &&
      !(state.paymentStatus === "PENDING" && state.paymentMethod === "CASH")
    ) {
      fail("Verify the POS online payment before dispatching products.", 409);
    }

    if (
      state?.channel === "FACEBOOK" &&
      data.status === "COMPLETED" &&
      state.paymentStatus !== "PAID"
    ) {
      fail(
        "Record the collected Facebook cash payment before completing delivery.",
        409,
      );
    }

    if (work.work_type === "DELIVERY") {
      await ensureOrderStockDispatched(
        connection,
        work.order_id,
        staff.id,
        state?.channel === "POS" && state.paymentStatus === "PAID",
      );
    } else if (
      state?.channel === "FACEBOOK" &&
      work.work_type === "INSTALLATION" &&
      data.status === "COMPLETED" &&
      !(await model.deliveryCompleted(work.order_id))
    ) {
      fail("Record delivery completion before completing installation.", 409);
    }
  }

  result = await model.updateWork(
    id,
    data.status,
    data.status === "COMPLETED" ? data.notes : "",
  );

  await recordServiceJobProgress(
    connection,
    work,
    staff,
    data.status,
    data.notes,
  );

  if (["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(data.status)) {
    await model.syncAssignmentStatus(id, data.status);
  }

  if (data.status === "COMPLETED" && work.order_id) {
    const state = await model.orderFulfillmentState(work.order_id);

    if (state?.channel === "FACEBOOK" && work.work_type === "DELIVERY") {
      await model.facebookOrderStatus(work.order_id, "IN_PROGRESS");
    }

    if (state?.channel === "FACEBOOK" && work.work_type === "INSTALLATION") {
      await model.facebookOrderStatus(work.order_id, "COMPLETED");
    }

    if (state?.channel === "POS" && !options.coordinatedOrderProgress) {
      await model.completeScheduledPosOrder(work.order_id);
    }
  }

  if (data.status === "COMPLETED") {
    await releaseCompletedAppointment(
      connection,
      appointmentKind,
      appointmentId,
    );
  }

  await model.addWorkHistory(
    id,
    work.status,
    data.status,
    staff.id,
    data.notes,
  );

  return {
    result,
    converted,
  };
}
