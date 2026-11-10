import connectDB from "../../utils/dbConn.js";
import { bookingScheduleModel } from "../../models/scheduling/bookingScheduleModel.js";
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

/** Must be called inside the caller's open transaction, so the booking and order roll back together. */
export async function reserveAppointment(db, kind, id, value) {
  if (
    !["ORDER", "SERVICE", "FB"].includes(kind) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) < 1
  ) {
    throw Object.assign(new Error("Invalid booking reference."), {
      status: 400,
    });
  }
  const { date, start } = parseBookingStart(value);
  const model = bookingScheduleModel(db);
  await model.ensureSlot(date, start);
  const setting = await model.lockSlot(date, start);
  const existing = await model.existingBooking(kind, id);
  // Closing a slot stops NEW reservations; it must not cancel an existing one.
  if (existing?.date === date && existing?.start === start) return;
  if (!setting || setting.closed)
    throw conflict("This time slot is closed. Choose another.");
  if ((await model.availableTechnicians(date, start)) < 1) {
    throw conflict(
      "All technicians are unavailable during this time. Choose another.",
    );
  }
  if ((await model.countSlot(date, start)) >= Number(setting.capacity)) {
    throw conflict(
      "This time slot is fully booked. Choose another available time.",
    );
  }
  await model.saveBooking(kind, id, date, start);
}

export async function releaseAppointment(db, kind, id) {
  await bookingScheduleModel(db).removeBooking(kind, id);
}

export async function transferAppointment(db, oldKind, oldId, newKind, newId) {
  const model = bookingScheduleModel(db);
  const existing = await model.existingBooking(oldKind, oldId);
  if (!existing) return false;
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
  const bookedMap = new Map(
    bookings.map((s) => [`${s.date}:${s.start}`, Number(s.booked)]),
  );
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
      const booked = bookedMap.get(`${date}:${slot.start}`) ?? 0;
      const closed = Boolean(setting?.closed);
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
      const staffUnavailable = activeTechs === 0 || blocked.size >= activeTechs;
      return {
        ...slot,
        capacity,
        booked,
        closed,
        staffUnavailable,
        available: future && !closed && !staffUnavailable && booked < capacity,
      };
    });
    result.push({ date, slots });
  }
  return { month, days: result };
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
  // Technicians may see busy slots, but not other customers' personal details.
  // Their own assigned customer/contact information is available in My Jobs.
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
    if (data.capacity < booked)
      throw conflict(
        `This slot already has ${booked} booking(s). Capacity cannot be lower.`,
      );
    await model.updateSlot(data.date, data.start, data.capacity, data.closed);
    return { saved: true };
  });
}

export async function updateCalendarDay(staff, raw) {
  const data = validateDaySettings(raw);
  return withSettingsTransaction(staff, async (model) => {
    // Keep capacity and existing reservations; only prevent future ones.
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
