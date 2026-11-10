/** All booking appointments use Philippine wall-clock time (UTC+08). */
export const BOOKING_SLOTS = [
  { start: "09:00", end: "11:00", label: "9:00 AM – 11:00 AM" },
  { start: "13:00", end: "15:00", label: "1:00 PM – 3:00 PM" },
  { start: "15:00", end: "17:00", label: "3:00 PM – 5:00 PM" },
];

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function parseBookingDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw invalid("Select a valid calendar date.");
  }
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw invalid("Select a valid calendar date.");
  }
  return date;
}

export function parseBookingStart(value) {
  if (typeof value !== "string")
    throw invalid("Select an available date and time.");
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::00)?$/.exec(value);
  if (!match)
    throw invalid("Select a date and time from the booking calendar.");
  const date = parseBookingDate(match[1]);
  if (!BOOKING_SLOTS.some((slot) => slot.start === match[2])) {
    throw invalid("Select a time slot shown on the booking calendar.");
  }
  const instant = Date.parse(`${date}T${match[2]}:00+08:00`);
  if (instant <= Date.now())
    throw invalid("Choose a future available appointment.");
  if (instant > Date.now() + 180 * 86400000) {
    throw invalid("Appointments can be booked up to 180 days ahead.");
  }
  return { date, start: match[2], sql: `${date} ${match[2]}:00` };
}

export function parseCalendarMonth(month) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw invalid("Select a valid calendar month.");
  }
  const first = Date.parse(`${month}-01T00:00:00+08:00`);
  const now = Date.now();
  if (first < now - 40 * 86400000 || first > now + 190 * 86400000) {
    throw invalid("Only nearby booking months can be viewed.");
  }
  return month;
}

export function validateSlotSettings(input) {
  const date = parseBookingDate(input?.date);
  const start = input?.start;
  if (!BOOKING_SLOTS.some((slot) => slot.start === start))
    throw invalid("Invalid time slot.");
  const capacity = Number(input?.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) {
    throw invalid("Capacity must be between 1 and 10.");
  }
  if (typeof input?.closed !== "boolean")
    throw invalid("Invalid availability status.");
  return { date, start, capacity, closed: input.closed };
}

export function validateDaySettings(input) {
  const date = parseBookingDate(input?.date);
  if (typeof input?.closed !== "boolean") throw invalid("Invalid day status.");
  return { date, closed: input.closed };
}
