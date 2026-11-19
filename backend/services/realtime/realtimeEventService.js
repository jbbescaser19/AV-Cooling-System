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
  "audit",
]);

const RULES = [
  [
    /^\/api\/auth\/customer\/register\/verify\/?$/,
    ["customers", "dashboard", "reports"],
  ],

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

  [/\/service-types(?:\/|$)/, ["services", "catalog", "dashboard"]],

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

  const management = /^\/api\/management\//.test(normalized);

  const business = /^\/api\/(?:management|customer)\//.test(normalized);

  const topics = new Set(
    matching.length
      ? matching.flatMap(([, values]) => values)
      : business
        ? ALL_TOPICS
        : [],
  );

  const add = (...values) => values.forEach((topic) => topics.add(topic));

  if (management) {
    add("audit");
  }

  // Archive changes may affect products, service types,
  // customers, staff, stock, schedules and reports.
  if (/\/archive(?:\/|$)/.test(normalized)) {
    add(...ALL_TOPICS);
  }

  if (/\/(?:staff|technicians)(?:\/|$)/.test(normalized)) {
    add("staff", "schedules", "jobs", "dashboard");
  }

  if (/\/customers(?:\/|$)/.test(normalized)) {
    add(
      "customers",
      "jobs",
      "schedules",
      "payments",
      "inventory",
      "catalog",
      "dashboard",
      "reports",
    );
  }

  if (/\/sales\/pos(?:\/|$)|\/facebook-requests/.test(normalized)) {
    add("jobs", "customers");
  }

  if (topics.has("feedback")) {
    add("reports");
  }

  return [...topics];
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
  if (Array.isArray(encoded)) {
    return encoded;
  }

  try {
    const value = JSON.parse(encoded);

    return Array.isArray(value) ? value : ALL_TOPICS;
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
 * Send only permitted topic notifications.
 * Checkpoints preserve the last event identifier
 * without refreshing unrelated pages.
 */
function deliver(res, audience, rawTopics, eventId) {
  if (res.destroyed || res.writableEnded) {
    return;
  }

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
  if (polling || clients.size === 0) {
    return;
  }

  polling = true;

  try {
    for (let batch = 0; batch < 5; batch += 1) {
      const rows = await realtimeEventModel(connectDB).since(cursor, 100);

      for (const entry of rows) {
        cursor = String(entry.id);

        const topics = eventTopics(entry.topics);

        for (const [res, client] of clients) {
          try {
            if (client.replaying) {
              for (const topic of topics) {
                client.pendingTopics.add(topic);
              }

              client.pendingId = cursor;
            } else {
              deliver(res, client.audience, topics, cursor);
            }
          } catch {
            clients.delete(res);
            res.end();
          }
        }
      }

      if (rows.length < 100) {
        break;
      }
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
 * Replay changes missed during disconnection.
 */
async function replayMissed(res, audience, fromId) {
  if (!fromId || res.destroyed || res.writableEnded) {
    return fromId;
  }

  const latest = await realtimeEventModel(connectDB).latestId();

  if (BigInt(fromId) > BigInt(latest)) {
    if (!res.destroyed && !res.writableEnded) {
      res.write(
        `id: ${latest}\n` +
          `event: reset\n` +
          `data: ${JSON.stringify({
            topics: allowedTopics(ALL_TOPICS, audience),
            cursor: latest,
          })}\n\n`,
      );
    }

    return latest;
  }

  const topics = new Set();

  let lastSeenId = fromId;
  let hasMore = false;

  for (let batch = 0; batch < 5; batch += 1) {
    const rows = await realtimeEventModel(connectDB).since(lastSeenId, 100);

    if (!rows.length) {
      if (batch === 0 && BigInt(latest) > BigInt(fromId)) {
        hasMore = true;
      }

      break;
    }

    // Recover if previous events have already
    // been removed from the retained event log.
    if (batch === 0 && BigInt(rows[0].id) > BigInt(fromId) + 1n) {
      for (const topic of allowedTopics(ALL_TOPICS, audience)) {
        topics.add(topic);
      }
    }

    for (const entry of rows) {
      lastSeenId = String(entry.id);

      for (const topic of allowedTopics(eventTopics(entry.topics), audience)) {
        topics.add(topic);
      }
    }

    if (rows.length < 100) {
      break;
    }

    if (batch === 4) {
      hasMore = true;
    }
  }

  if (hasMore) {
    for (const topic of allowedTopics(ALL_TOPICS, audience)) {
      topics.add(topic);
    }

    lastSeenId = await realtimeEventModel(connectDB).latestId();
  }

  if (lastSeenId !== fromId && !res.destroyed && !res.writableEnded) {
    deliver(res, audience, [...topics], lastSeenId);
  }

  return lastSeenId;
}

export async function subscribeRealtime(req, res, audience = "staff") {
  if (clients.size >= 300) {
    return res.status(503).json({
      success: false,

      message: "Live connection busy. Refresh manually if needed.",
    });
  }

  if (!timer) {
    const latest = await realtimeEventModel(connectDB).latestId();

    if (!timer) {
      cursor = latest;
    }
  }

  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",

    "Cache-Control": "private, no-cache, no-transform",

    "X-Accel-Buffering": "no",

    Connection: "keep-alive",
  });

  res.flushHeaders();

  res.write(": connected\nretry: 3000\n\n");

  const requestedId = String(
    req.get("Last-Event-ID") || req.query?.lastEventId || "",
  ).trim();

  const validId = /^\d{1,20}$/.test(requestedId);

  const client = {
    audience,
    replaying: validId,
    pendingTopics: new Set(),
    pendingId: null,
  };

  if (!validId) {
    deliver(res, audience, [], cursor);
  }

  clients.set(res, client);

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

  // Preserve the existing SSE authentication
  // renewal interval.
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

  if (validId) {
    try {
      const replayedId = await replayMissed(res, audience, requestedId);

      if (!clients.has(res) || res.destroyed || res.writableEnded) {
        return;
      }

      if (client.pendingId && BigInt(client.pendingId) > BigInt(replayedId)) {
        deliver(res, audience, [...client.pendingTopics], client.pendingId);
      }

      client.pendingTopics.clear();
      client.pendingId = null;
      client.replaying = false;
    } catch (error) {
      console.error("Realtime reconnect catch-up error:", error);

      res.end();
    }
  }
}

export async function cleanupRealtimeEvents() {
  await realtimeEventModel(connectDB).cleanup();
}
