import connectDB from "../../utils/dbConn.js";
import { realtimeEventModel } from "../../models/realtime/realtimeEventModel.js";

const ALL_TOPICS = Object.freeze([
  "dashboard",
  "orders",
  "services",
  "payments",
  "schedules",
  "inventory",
  "catalog",
  "notifications",
  "jobs",
  "feedback",
  "customers",
  "staff",
  "archive",
  "reports",
  "cart",
]);

const RULES = [
  [
    /\/webhooks\/paymongo|\/paymongo(?:\/|$)/,
    ["payments", "orders", "services", "notifications", "reports", "dashboard"],
  ],
  [
    /\/management\/orders(?:\/|$)|\/customer\/orders(?:\/|$)|\/sales\/orders(?:\/|$)|\/order-progress|\/order-events/,
    [
      "orders",
      "payments",
      "inventory",
      "catalog",
      "schedules",
      "jobs",
      "dashboard",
      "notifications",
      "reports",
      "cart",
    ],
  ],
  [
    /\/management\/services(?:\/|$)|\/customer\/services(?:\/|$)|\/customer\/account\/my-services(?:\/|$)|\/service-requests|\/service-events|\/walk-in-services/,
    [
      "services",
      "payments",
      "schedules",
      "jobs",
      "dashboard",
      "notifications",
      "reports",
    ],
  ],
  [
    /\/management\/field-work(?:\/|$)|\/source-team|\/work-orders|\/technician|\/booking|\/schedule/,
    ["schedules", "jobs", "orders", "services", "dashboard", "notifications"],
  ],
  [
    /\/sales\/pos(?:\/|$)|\/facebook-requests/,
    [
      "orders",
      "services",
      "payments",
      "inventory",
      "catalog",
      "schedules",
      "dashboard",
      "notifications",
      "reports",
    ],
  ],
  [
    /\/service-payments|\/sales\/payments/,
    ["payments", "orders", "services", "dashboard", "notifications", "reports"],
  ],
  [
    /\/stock-movements|\/inventory|\/products|\/variants|\/categories|\/catalog/,
    ["inventory", "catalog", "cart", "dashboard", "orders"],
  ],
  [/\/feedback/, ["feedback", "dashboard", "notifications"]],
  [/\/notifications/, ["notifications"]],
  [
    /\/customers|\/customer\/account\/addresses|\/customer\/account\/profile/,
    ["customers", "orders", "services", "notifications", "archive"],
  ],
  [
    /\/staff|\/audit-logs|\/archive/,
    ["staff", "customers", "archive", "dashboard", "jobs", "notifications"],
  ],
  [/\/cart/, ["cart", "inventory"]],
];

const PUBLIC_TOPICS = new Set([
  "catalog",
  "inventory",
  "schedules",
  "feedback",
]);

const CUSTOMER_TOPICS = new Set([
  ...PUBLIC_TOPICS,
  "orders",
  "services",
  "payments",
  "notifications",
  "cart",
  "customers",
  "jobs",
]);

export function changedTopics(path) {
  const normalized = String(path || "").split("?")[0];

  const matching = RULES.filter(([pattern]) => pattern.test(normalized));

  if (matching.length) {
    return [...new Set(matching.flatMap(([, topics]) => topics))];
  }

  return /^\/api\/(?:management|customer)\//.test(normalized) ? ALL_TOPICS : [];
}

export async function recordBusinessChange(path) {
  const topics = changedTopics(path);

  if (!topics.length) return;

  await realtimeEventModel(connectDB).record(topics);
}

function allowedTopics(raw, audience) {
  const topics = Array.isArray(raw)
    ? raw.filter((topic) => ALL_TOPICS.includes(topic))
    : ALL_TOPICS;

  if (audience === "staff") {
    return topics;
  }

  const allowed = audience === "customer" ? CUSTOMER_TOPICS : PUBLIC_TOPICS;

  return topics.filter((topic) => allowed.has(topic));
}

function eventTopics(encoded) {
  try {
    return JSON.parse(encoded);
  } catch {
    return ALL_TOPICS;
  }
}

const clients = new Map();

let timer = null;
let cursor = "0";
let polling = false;
let errorCount = 0;

/**
 * Notify clients only about actual business changes.
 *
 * An irrelevant topic becomes a checkpoint, allowing
 * EventSource to remember its last received event ID
 * without refreshing unrelated pages.
 */
function deliver(res, audience, rawTopics, eventId) {
  if (res.destroyed || res.writableEnded) return;

  const topics = allowedTopics(rawTopics, audience);

  const eventName = topics.length ? "change" : "checkpoint";

  const payload = topics.length ? { topics } : {};

  res.write(
    `id: ${eventId}\n` +
      `event: ${eventName}\n` +
      `data: ${JSON.stringify(payload)}\n\n`,
  );
}

async function checkForChanges() {
  if (polling || clients.size === 0) return;

  polling = true;

  try {
    for (let batch = 0; batch < 5; batch += 1) {
      const rows = await realtimeEventModel(connectDB).since(cursor, 100);

      for (const entry of rows) {
        cursor = String(entry.id);

        const topics = eventTopics(entry.topics);

        for (const [res, audience] of clients) {
          try {
            deliver(res, audience, topics, cursor);
          } catch {
            clients.delete(res);
            res.end();
          }
        }
      }

      if (rows.length < 100) break;
    }

    errorCount = 0;
  } catch (error) {
    errorCount += 1;

    if (errorCount === 1 || errorCount % 30 === 0) {
      console.error("Realtime watcher error:", error);
    }
  } finally {
    polling = false;
  }
}

/**
 * Reconnect safely:
 *
 * Native EventSource remembers Last-Event-ID.
 * Replay only events missed during disconnection.
 * Do not broadcast an unnecessary ALL_TOPICS refresh
 * whenever someone opens or reconnects to the website.
 */
async function replayMissed(res, audience, fromId) {
  if (!fromId || res.destroyed || res.writableEnded) {
    return;
  }

  const topics = new Set();
  let lastSeenId = fromId;
  let hasMore = false;

  for (let batch = 0; batch < 5; batch += 1) {
    const rows = await realtimeEventModel(connectDB).since(lastSeenId, 100);

    if (!rows.length) break;

    for (const entry of rows) {
      lastSeenId = String(entry.id);

      for (const topic of allowedTopics(eventTopics(entry.topics), audience)) {
        topics.add(topic);
      }
    }

    if (rows.length < 100) break;

    if (batch === 4) {
      hasMore = true;
    }
  }

  if (hasMore) {
    // If many changes were missed, do just one
    // catch-up refresh rather than hundreds.
    for (const topic of allowedTopics(ALL_TOPICS, audience)) {
      topics.add(topic);
    }

    lastSeenId = await realtimeEventModel(connectDB).latestId();
  }

  if (lastSeenId !== fromId && !res.destroyed && !res.writableEnded) {
    deliver(res, audience, [...topics], lastSeenId);
  }
}

export async function subscribeRealtime(req, res, audience = "staff") {
  if (clients.size >= 300) {
    return res.status(503).json({
      success: false,
      message: "Live connection busy. Refresh manually if needed.",
    });
  }

  // Each page fetches its initial data through normal APIs.
  // A new SSE connection must not force another full refresh.
  if (!timer) {
    cursor = await realtimeEventModel(connectDB).latestId();
  }

  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-cache, no-transform",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  res.write(": connected\nretry: 3000\n\n");

  clients.set(res, audience);

  if (!timer) {
    timer = setInterval(() => {
      void checkForChanges();
    }, 2000);

    timer.unref?.();
  }

  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(": heartbeat\n\n");
    }
  }, 20000);

  // Preserve the existing two-minute SSE
  // authentication renewal requirement.
  const expire = setTimeout(() => res.end(), 120000);

  const cleanup = () => {
    clients.delete(res);

    clearInterval(heartbeat);
    clearTimeout(expire);

    if (clients.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  res.once("close", cleanup);

  const lastId = String(req.get("Last-Event-ID") || "").trim();

  if (/^\d{1,20}$/.test(lastId)) {
    try {
      await replayMissed(res, audience, lastId);
    } catch (error) {
      console.error("Realtime reconnect catch-up error:", error);
    }
  }
}

export async function cleanupRealtimeEvents() {
  await realtimeEventModel(connectDB).cleanup();
}
