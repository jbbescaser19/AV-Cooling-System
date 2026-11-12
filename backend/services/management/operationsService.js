import { z } from "zod";

import connectDB from "../../utils/dbConn.js";

import { operationsModel } from "../../models/management/operationsModel.js";
import {
  releaseOrderReservation,
  fulfillOrderReservation,
} from "../customer/order/stockReservationService.js";

import { createCustomerNotification } from "../customer/notification/notificationService.js";

const EVENT_LABELS = {
  ORDER_ACCEPTED: [
    "Order accepted",
    "Your air conditioner order has been accepted.",
  ],

  INSTALLATION_SCHEDULED: [
    "Installation scheduled",
    "Your delivery and installation appointment has been scheduled.",
  ],

  SCHEDULE_CHANGED: [
    "Installation rescheduled",
    "Your delivery and installation schedule has changed.",
  ],

  ORDER_OUT_FOR_DELIVERY: [
    "Out for delivery",
    "Your air conditioner is on its way.",
  ],

  ORDER_DELIVERED: [
    "Order delivered",
    "Your air conditioner has been delivered.",
  ],

  INSTALLATION_STARTED: [
    "Installation started",
    "The installation work has started.",
  ],

  INSTALLATION_COMPLETED: [
    "Installation completed",
    "Your air conditioner installation has been completed.",
  ],

  PAYMENT_CONFIRMED: [
    "Payment confirmed",
    "Your cash payment has been received and recorded.",
  ],

  EXTRA_CHARGES_PROPOSED: [
    "Additional work needs approval",
    "The store has proposed additional installation work. No extra charge has been added to your order.",
  ],

  ORDER_DECLINED: ["Order declined", "The store could not accept your order."],

  ORDER_CANCELLED_BY_STAFF: [
    "Order cancelled by store",
    "The store cancelled your order.",
  ],

  SERVICE_ACCEPTED: [
    "Service accepted",
    "Your service request has been approved.",
  ],

  SERVICE_SCHEDULED: [
    "Service scheduled",
    "Your service appointment has been scheduled.",
  ],

  SERVICE_RESCHEDULED: [
    "Service rescheduled",
    "Your service appointment has been changed.",
  ],

  SERVICE_STARTED: [
    "Service started",
    "A technician has started your requested service.",
  ],

  SERVICE_COMPLETED: [
    "Service completed",
    "Your requested service has been completed.",
  ],

  SERVICE_CANCELLED: [
    "Service cancelled",
    "Your service appointment has been cancelled.",
  ],

  SERVICE_DECLINED: [
    "Service declined",
    "Your service request could not be accepted.",
  ],
};

const eventSchema = z
  .object({
    requestKey: z.string().uuid(),

    eventCode: z.enum(Object.keys(EVENT_LABELS)),

    note: z.string().trim().max(1000).default(""),

    schedule: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable()
      .default(null),

    paymentVerified: z.boolean().optional(),
  })
  .strict();

const scheduleEvents = new Set([
  "INSTALLATION_SCHEDULED",
  "SCHEDULE_CHANGED",
  "SERVICE_SCHEDULED",
  "SERVICE_RESCHEDULED",
]);

const requiredNotes = new Set([
  "ORDER_DECLINED",
  "ORDER_CANCELLED_BY_STAFF",
  "SCHEDULE_CHANGED",
  "EXTRA_CHARGES_PROPOSED",
  "SERVICE_DECLINED",
  "SERVICE_CANCELLED",
  "SERVICE_RESCHEDULED",
]);

const orderEvents = new Set([
  "ORDER_ACCEPTED",
  "INSTALLATION_SCHEDULED",
  "SCHEDULE_CHANGED",
  "ORDER_OUT_FOR_DELIVERY",
  "ORDER_DELIVERED",
  "INSTALLATION_STARTED",
  "INSTALLATION_COMPLETED",
  "PAYMENT_CONFIRMED",
  "EXTRA_CHARGES_PROPOSED",
  "ORDER_DECLINED",
  "ORDER_CANCELLED_BY_STAFF",
]);

function fail(message, status = 409) {
  const error = new Error(message);
  error.status = status;

  throw error;
}

function scheduleToSQL(value) {
  if (!value) {
    fail("A confirmed date and time is required.", 400);
  }

  const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number);

  const timestamp = Date.UTC(year, month - 1, day, hour, minute);

  const verified = new Date(timestamp);

  if (
    verified.getUTCFullYear() !== year ||
    verified.getUTCMonth() !== month - 1 ||
    verified.getUTCDate() !== day ||
    verified.getUTCHours() !== hour ||
    verified.getUTCMinutes() !== minute ||
    timestamp - 8 * 3600000 <= Date.now()
  ) {
    fail("Select a future date and time in Philippine time.", 400);
  }

  return `${value.replace("T", " ")}:00`;
}

function assertStaffRole(staff, eventCode) {
  if (["OWNER", "MANAGER"].includes(staff?.role)) {
    return;
  }

  if (staff?.role === "SALES_CASHIER" && eventCode === "PAYMENT_CONFIRMED") {
    return;
  }

  fail("This staff role cannot record that event.", 403);
}

function requireStatus(current, event, ...allowed) {
  if (!allowed.includes(current)) {
    fail(`Cannot record ${event} while the record is ${current}.`);
  }
}

async function requirePreviousEvent(model, kind, recordId, code) {
  if (!(await model.hasEvent(kind, recordId, code))) {
    fail(`Record ${code.replaceAll("_", " ").toLowerCase()} first.`);
  }
}

async function forbidRepeatedEvent(model, kind, recordId, code) {
  if (await model.hasEvent(kind, recordId, code)) {
    fail("This milestone was already recorded.");
  }
}

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

async function transitionOrder(
  model,
  connection,
  order,
  data,
  staffId,
  scheduleSQL,
) {
  const code = data.eventCode;
  const status = order.status;
  const id = order.id;

  let next = status;

  if (code === "ORDER_ACCEPTED") {
    requireStatus(status, code, "PENDING");

    next = "CONFIRMED";
  } else if (code === "INSTALLATION_SCHEDULED") {
    requireStatus(status, code, "CONFIRMED");

    await forbidRepeatedEvent(model, "ORDER", id, code);

    next = "SCHEDULED";
  } else if (code === "SCHEDULE_CHANGED") {
    requireStatus(status, code, "SCHEDULED");

    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_SCHEDULED");

    if (order.schedule === data.schedule) {
      fail("Choose a different appointment time.");
    }
  } else if (code === "ORDER_OUT_FOR_DELIVERY") {
    requireStatus(status, code, "SCHEDULED");

    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_SCHEDULED");

    next = "IN_PROGRESS";
  } else if (code === "ORDER_DELIVERED") {
    requireStatus(status, code, "IN_PROGRESS");

    await requirePreviousEvent(model, "ORDER", id, "ORDER_OUT_FOR_DELIVERY");

    await forbidRepeatedEvent(model, "ORDER", id, code);
    // Delivery is the physical stock-out. Order creation only reserves units.
    await fulfillOrderReservation(connection, id, staffId);
  } else if (code === "INSTALLATION_STARTED") {
    requireStatus(status, code, "IN_PROGRESS");

    await requirePreviousEvent(model, "ORDER", id, "ORDER_DELIVERED");

    await forbidRepeatedEvent(model, "ORDER", id, code);
  } else if (code === "INSTALLATION_COMPLETED") {
    requireStatus(status, code, "IN_PROGRESS");

    await requirePreviousEvent(model, "ORDER", id, "INSTALLATION_STARTED");

    next = "COMPLETED";
  } else if (code === "EXTRA_CHARGES_PROPOSED") {
    requireStatus(status, code, "CONFIRMED", "SCHEDULED", "IN_PROGRESS");
  } else if (code === "PAYMENT_CONFIRMED") {
    requireStatus(
      status,
      code,
      "CONFIRMED",
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
    );

    if (order.paymentStatus !== "PENDING" || data.paymentVerified !== true) {
      fail(
        "Cash must actually be collected and verified before recording payment.",
      );
    }

    const payments = await model.lockPayments(id);

    if (
      payments.length !== 1 ||
      payments[0].status !== "PENDING" ||
      payments[0].method !== "CASH"
    ) {
      fail("Payment records are not eligible for confirmation.");
    }

    const paymentUpdated = await model.markPaymentPaid(
      payments[0].id,
      staffId,
      data.note || "Cash collected and verified by staff.",
    );

    if (paymentUpdated !== 1) {
      fail("Payment changed during verification. Please refresh.");
    }

    const orderUpdated = await model.markOrderPaymentPaid(id);

    if (orderUpdated !== 1) {
      fail("Order payment changed during verification. Please refresh.");
    }
  } else if (code === "ORDER_DECLINED" || code === "ORDER_CANCELLED_BY_STAFF") {
    const allowed =
      code === "ORDER_DECLINED"
        ? ["PENDING"]
        : ["PENDING", "CONFIRMED", "SCHEDULED"];

    requireStatus(status, code, ...allowed);

    if (order.paymentStatus !== "PENDING") {
      fail("A paid order needs a separate refund workflow.");
    }

    const payments = await model.lockPayments(id);

    if (
      !payments.length ||
      payments.some((payment) => payment.status !== "PENDING")
    ) {
      fail("Payment is not eligible for cancellation.");
    }

    if (await model.hasEvent("ORDER", id, "ORDER_OUT_FOR_DELIVERY")) {
      fail("Order already left for delivery.");
    }

    await model.cancelPendingPayments(id);
    await model.cancelOrderPayment(id);
    await releaseOrderReservation(connection, id);

    next = "CANCELLED";
  } else {
    fail("Invalid order event.", 400);
  }

  if (next !== status || scheduleSQL) {
    await model.setOrderStatus(id, next, scheduleSQL);
  }

  await model.addOrderHistory(
    id,
    status,
    next,
    staffId,
    `${EVENT_LABELS[code][0]}${data.note ? `: ${data.note}` : ""}`,
  );
}

async function transitionService(model, service, data, scheduleSQL) {
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

    await requirePreviousEvent(model, "SERVICE", id, "SERVICE_SCHEDULED");

    if (await has("SERVICE_STARTED")) {
      fail("Service has already started.");
    }

    if (service.schedule === data.schedule) {
      fail("Choose a different appointment time.");
    }
  } else if (code === "SERVICE_STARTED") {
    requireStatus(status, code, "CONFIRMED");

    await requirePreviousEvent(model, "SERVICE", id, "SERVICE_SCHEDULED");

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

  const visibleNote = data.note ? ` Note from store: ${data.note}` : "";

  const dateNote = scheduleSQL
    ? ` Date/time (Philippines): ${data.schedule.replace("T", " at ")}.`
    : "";

  await model.addEvent({
    requestKey: data.requestKey,
    kind,
    recordId: record.id,
    eventCode: data.eventCode,
    staffId: staff.id,
    note: data.note || null,
    schedule: scheduleSQL,
  });

  const destination =
    kind === "ORDER"
      ? `/account/orders/${record.reference}`
      : `/account/services/${record.id}`;

  if (record.userId)
    await createCustomerNotification(
      connection,
      record.userId,
      data.eventCode,
      title,
      `${description}${dateNote}${visibleNote}`,
      destination,
    );
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

  if (data.schedule && !scheduleEvents.has(data.eventCode)) {
    fail("This event does not accept a schedule.", 400);
  }

  const scheduleSQL = scheduleEvents.has(data.eventCode)
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

    await addNotificationForEvent(
      model,
      connection,
      kind,
      record,
      staff,
      data,
      scheduleSQL,
    );

    await connection.commit();

    return {
      alreadyRecorded: false,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
