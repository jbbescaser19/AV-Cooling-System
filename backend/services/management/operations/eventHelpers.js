export function fail(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function scheduleToSQL(value) {
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
export function assertStaffRole(staff, eventCode) {
  if (["OWNER", "MANAGER"].includes(staff?.role)) {
    return;
  }
  if (staff?.role === "SALES_CASHIER" && eventCode === "PAYMENT_CONFIRMED") {
    return;
  }
  fail("This staff role cannot record that event.", 403);
}
export function requireStatus(current, event, ...allowed) {
  if (!allowed.includes(current)) {
    fail(`Cannot record ${event} while the record is ${current}.`);
  }
}
export async function requirePreviousEvent(model, kind, recordId, code) {
  if (!(await model.hasEvent(kind, recordId, code))) {
    fail(`Record ${code.replaceAll("_", " ").toLowerCase()} first.`);
  }
}
export async function forbidRepeatedEvent(model, kind, recordId, code) {
  if (await model.hasEvent(kind, recordId, code)) {
    fail("This milestone was already recorded.");
  }
}
