/** Shared pure rules for management module services. */
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function affected(result, message = "Record not found.") {
  if (!result || result.affectedRows !== 1) {
    fail(message, 404);
  }
}
export function localSQL(value) {
  const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getTime() - 8 * 3600000 <= Date.now()
  ) {
    fail("Choose a valid future date and time (Philippine time).");
  }
  return `${value.replace("T", " ")}:00`;
}
export function validDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  if (
    x.getUTCFullYear() !== y ||
    x.getUTCMonth() !== m - 1 ||
    x.getUTCDate() !== d
  ) {
    fail("Invalid date.");
  }
}
export function checkFbUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (
      u.protocol !== "https:" ||
      ![
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "messenger.com",
        "www.messenger.com",
        "m.me",
      ].includes(u.hostname.toLowerCase()) ||
      u.username ||
      u.password
    ) {
      fail("Enter a Facebook or Messenger URL.");
    }
    return u.href;
  } catch {
    fail("Enter a valid Facebook or Messenger link.");
  }
}
export async function verifyTechnician(
  model,
  technicianId,
  dateTime,
  omitWorkId = 0,
) {
  const technician = (await model.findTechnician(technicianId))[0];
  if (technician?.status !== "ACTIVE") {
    fail("Technician is not active.", 409);
  }
  if ((await model.checkTechOff(technicianId, dateTime))[0]) {
    fail(
      "Technician has an unavailable period overlapping this appointment.",
      409,
    );
  }
  if ((await model.checkTechBusy(technicianId, dateTime, omitWorkId))[0]) {
    fail("Technician already has an overlapping job at that time.", 409);
  }
}
