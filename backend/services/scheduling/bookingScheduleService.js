import connectDB from "../../utils/dbConn.js";
import { bookingScheduleModel } from "../../models/scheduling/bookingScheduleModel.js";
import { technicianCalendarModel } from "../../models/scheduling/technicianCalendarModel.js";
import {
  BOOKING_SLOTS,
  parseBookingStart,
  parseBookingDate,
  parseCalendarMonth,
  validateDaySettings,
  validateSlotSettings,
} from "../../validators/scheduling/bookingScheduleValidator.js";

const conflict = (message) =>
  Object.assign(new Error(message), { status: 409 });

/**
 * The caller owns the transaction.
 * Lock the appointment slot before checking its capacity.
 */
async function checkAppointment(db, kind, id, value, options = {}) {
  if (
    !["ORDER", "SERVICE", "FB"].includes(kind) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) < 1
  ) {
    throw Object.assign(new Error("Invalid booking reference."), {
      status: 400,
    });
  }

  const model = bookingScheduleModel(db);
  const source = await model.sourceState(kind, id);

  if (
    !source ||
    ["COMPLETED", "CANCELLED", "CONVERTED"].includes(source.status)
  ) {
    throw conflict("This appointment is no longer active.");
  }

  const temporary = source.status === "PENDING" && !options.confirmed;

  if (
    temporary &&
    kind !== "FB" &&
    source.customerId &&
    (await model.otherPendingRequests(source.customerId, kind, id)) >= 2
  ) {
    throw conflict(
      "You already have two other pending requests. Wait for the store to review them or cancel an unwanted request.",
    );
  }

  // Pickup-only orders do not require an appointment.
  if (!value && kind === "ORDER") {
    if (!options.validateOnly) {
      await model.removeBooking(kind, id);
    }

    return;
  }

  const { date, start } = parseBookingStart(value, {
    allowCurrent: options.allowCurrent === true,
  });

  await model.ensureSlot(date, start);

  const setting = await model.lockSlot(date, start);
  const existing = await model.existingBooking(kind, id);

  const sameActive =
    existing?.date === date &&
    existing?.start === start &&
    Boolean(Number(existing.active));

  if (sameActive) {
    if (!temporary && !options.validateOnly) {
      await model.confirmBooking(kind, id);
    }

    return;
  }

  // Editing another field must not renew an expired hold.
  if (
    temporary &&
    existing?.date === date &&
    existing?.start === start &&
    !options.validateOnly
  ) {
    return;
  }

  if (!setting || Number(setting.closed) === 1) {
    throw conflict("This time slot is closed. Choose another.");
  }

  const activeTechs = await model.activeTechnicianCount();

  if (activeTechs > 0 && (await model.availableTechnicians(date, start)) < 1) {
    throw conflict(
      "All technicians are unavailable during this time. Choose another.",
    );
  }

  const booked = await model.countSlot(date, start);

  if (booked >= Number(setting.capacity)) {
    throw conflict(
      "This appointment was just reserved or is fully booked. Please choose another available schedule.",
    );
  }

  if (!options.validateOnly) {
    await model.saveBooking(kind, id, date, start, temporary);
  }
}

/**
 * Existing interface retained for customer submissions.
 * Facebook drafts only validate availability.
 */
export async function checkPreferredAppointment(db, kind, id, value) {
  return checkAppointment(db, kind, id, value, {
    validateOnly: kind === "FB",
  });
}

/**
 * Pending bookings receive a temporary reservation.
 * Confirmed bookings receive a firm reservation.
 */
export async function reserveAppointment(db, kind, id, value, options = {}) {
  return checkAppointment(db, kind, id, value, options);
}

export async function releaseAppointment(db, kind, id) {
  await bookingScheduleModel(db).removeBooking(kind, id);
}

export async function transferAppointment(db, oldKind, oldId, newKind, newId) {
  const model = bookingScheduleModel(db);

  const existing = await model.existingBooking(oldKind, oldId);

  if (!existing || !Number(existing.active)) {
    return false;
  }

  return (await model.transferBooking(oldKind, oldId, newKind, newId)) === 1;
}

export async function getAvailability(monthValue) {
  const month = parseCalendarMonth(monthValue);
  const model = bookingScheduleModel(connectDB);

  const [settings, bookings, activeTechs, offBlocks] = await Promise.all([
    model.monthSettings(month),
    model.monthCounts(month),
    model.activeTechnicianCount(),
    model.monthStaffBlocks(month),
  ]);

  const settingMap = new Map(settings.map((s) => [`${s.date}:${s.start}`, s]));

  const bookedMap = new Map(bookings.map((s) => [`${s.date}:${s.start}`, s]));

  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));

  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const result = [];
  const now = Date.now();

  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;

    const slots = BOOKING_SLOTS.map((slot) => {
      const setting = settingMap.get(`${date}:${slot.start}`);

      const capacity = Number(setting?.capacity ?? 1);

      const counts = bookedMap.get(`${date}:${slot.start}`);

      const booked = Number(counts?.booked || 0);
      const held = Number(counts?.held || 0);

      const closed = Number(setting?.closed ?? 0) === 1;

      const future = Date.parse(`${date}T${slot.start}:00+08:00`) > now;

      const startMins =
        Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3, 5));

      const blocked = new Set(
        offBlocks
          .filter((b) => {
            if (b.date !== date) return false;

            if (!b.start || !b.end) return true;

            const blockStart =
              Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3, 5));

            const blockEnd =
              Number(b.end.slice(0, 2)) * 60 + Number(b.end.slice(3, 5));

            return blockStart < startMins + 120 && blockEnd > startMins;
          })
          .map((b) => Number(b.technicianId)),
      );

      const staffUnavailable = activeTechs > 0 && blocked.size >= activeTechs;

      return {
        ...slot,
        capacity,
        booked,
        held,
        confirmed: booked - held,
        closed,
        staffUnavailable,
        available: future && !closed && !staffUnavailable && booked < capacity,
      };
    });

    result.push({ date, slots });
  }

  return {
    month,
    days: result,
    hasActiveTechnicians: activeTechs > 0,
  };
}

export async function getCalendarDay(staff, date) {
  if (
    !staff?.id ||
    !["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"].includes(staff.role)
  ) {
    throw Object.assign(new Error("Not allowed."), { status: 403 });
  }

  parseBookingDate(date);

  const bookings = await bookingScheduleModel(connectDB).dayBookings(date);

  // Prevent technicians from viewing other customers'
  // private appointment information.
  if (staff.role === "TECHNICIAN") {
    return bookings.map((item) => ({
      kind: item.kind,
      start: item.start,
      status: "BOOKED",
      reference: "Booked appointment",
    }));
  }

  return bookings;
}

async function withSettingsTransaction(staff, work) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    throw Object.assign(
      new Error("Only an owner or manager can manage availability."),
      { status: 403 },
    );
  }

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const outcome = await work(bookingScheduleModel(db));

    await db.commit();

    return outcome;
  } catch (error) {
    await db.rollback();

    throw error;
  } finally {
    db.release();
  }
}

export async function updateCalendarSlot(staff, raw) {
  const data = validateSlotSettings(raw);

  return withSettingsTransaction(staff, async (model) => {
    await model.ensureSlot(data.date, data.start);
    await model.lockSlot(data.date, data.start);

    const booked = await model.countSlot(data.date, data.start);

    if (data.capacity < booked) {
      throw conflict(
        `This slot already has ${booked} booking(s). Capacity cannot be lower.`,
      );
    }

    await model.updateSlot(data.date, data.start, data.capacity, data.closed);

    return { saved: true };
  });
}

export async function updateCalendarDay(staff, raw) {
  const data = validateDaySettings(raw);

  return withSettingsTransaction(staff, async (model) => {
    for (const slot of BOOKING_SLOTS) {
      await model.ensureSlot(data.date, slot.start);

      const current = await model.lockSlot(data.date, slot.start);

      await model.updateSlot(
        data.date,
        slot.start,
        Number(current.capacity),
        data.closed,
      );
    }

    return { saved: true };
  });
}

export async function getMyTechnicianCalendar(staff, rawMonth) {
  if (!staff?.id || staff.role !== "TECHNICIAN") {
    throw Object.assign(new Error("Technician access required."), {
      status: 403,
    });
  }

  const month = parseCalendarMonth(rawMonth);
  const model = technicianCalendarModel(connectDB);

  const [jobs, blocks, upcoming] = await Promise.all([
    model.jobsForMonth(staff.id, month),
    model.offBlocksForMonth(staff.id, month),
    model.nextJobs(staff.id),
  ]);

  return {
    month,
    jobs,
    blocks,
    upcoming,
  };
}
