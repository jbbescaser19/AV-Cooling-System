const STATUSES = new Set([
  "ALL",
  "PENDING",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
const CHANNELS = new Set(["ALL", "ONLINE", "FACEBOOK", "POS"]);

export function validateOrderListQuery(raw = {}) {
  const page = Number(raw.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    throw Object.assign(new Error("Invalid page number."), { status: 400 });
  const status = String(raw.status ?? "ALL").toUpperCase();
  const channel = String(raw.channel ?? "ALL").toUpperCase();
  if (!STATUSES.has(status) || !CHANNELS.has(channel))
    throw Object.assign(new Error("Invalid order filter."), { status: 400 });
  const search = String(raw.search ?? "").trim();
  if (search.length > 100)
    throw Object.assign(new Error("Search must be 100 characters or fewer."), {
      status: 400,
    });
  return { page, status, channel, search, pageSize: 20 };
}
