import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import connectDB from "../../utils/dbConn.js";
import { staffModel } from "../../models/management/staffModel.js";
import { staffSessionModel } from "../../models/management/staffSessionModel.js";

export const STAFF_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const STAFF_IDLE_MS = 15 * 60 * 1000;
export const STAFF_WARNING_MS = 2 * 60 * 1000;

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function fail(message, status = 401) {
  throw Object.assign(new Error(message), { status });
}

function enforceAttemptLimit(key) {
  const now = Date.now();
  if (attempts.size >= 3000) {
    for (const [attemptKey, item] of attempts) {
      if (now - item.start >= WINDOW_MS) attempts.delete(attemptKey);
    }
    if (attempts.size >= 3000) attempts.delete(attempts.keys().next().value);
  }
  const entry = attempts.get(key);
  if (entry && now - entry.start < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    fail("Too many attempts. Try again in 15 minutes.", 429);
  }
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const previous = attempts.get(key);
  const entry =
    previous && now - previous.start < WINDOW_MS
      ? previous
      : { start: now, count: 0 };
  entry.count += 1;
  attempts.set(key, entry);
}

function validateStaffToken(token, { ignoreExpiration = false } = {}) {
  if (!token) fail("Staff login required.");
  if (!process.env.ACCESS_SECRET)
    fail("Staff authentication is not configured.", 500);

  let payload;
  try {
    payload = jwt.verify(token, process.env.ACCESS_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration,
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      fail("Staff session expired. Sign in again.");
    }
    throw error;
  }

  if (
    payload.scope !== "staff" ||
    !/^[1-9]\d*$/.test(String(payload.sub ?? "")) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(payload.sid ?? ""),
    )
  ) {
    fail("Invalid staff session.");
  }
  return { staffId: Number(payload.sub), sessionId: payload.sid };
}

function toResponse(row, sessionId) {
  const lastActivityAt = Number(row.lastActivityAt);
  return {
    staff: { id: row.id, name: row.name, email: row.email, role: row.role },
    session: {
      id: sessionId,
      idleExpiresAt: lastActivityAt + STAFF_IDLE_MS,
      absoluteExpiresAt: Number(row.absoluteExpiresAt),
      reauthenticatedUntil:
        row.reauthenticatedUntil == null
          ? null
          : Number(row.reauthenticatedUntil),
      serverNow: Number(row.serverNow),
    },
  };
}

export async function signInStaff(
  emailInput,
  password,
  remoteAddress = "unknown",
) {
  const email = String(emailInput || "")
    .trim()
    .toLowerCase();
  const key = `login:${remoteAddress}:${email.slice(0, 150)}`;
  enforceAttemptLimit(key);

  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    !password
  ) {
    fail("Invalid email or password.");
  }

  const staff = await staffModel(connectDB).findActiveByEmail(email);
  const valid =
    staff?.role && staff.passwordHash
      ? await bcrypt.compare(password, staff.passwordHash)
      : false;
  if (!valid) {
    recordFailedAttempt(key);
    fail("Invalid email or password.");
  }
  if (!process.env.ACCESS_SECRET)
    fail("Staff authentication is not configured.", 500);

  const sessionId = randomUUID();
  const token = jwt.sign(
    { scope: "staff", sid: sessionId },
    process.env.ACCESS_SECRET,
    {
      algorithm: "HS256",
      subject: String(staff.id),
      expiresIn: "8h",
    },
  );

  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    await staffSessionModel(connection).create(sessionId, staff.id);
    await staffModel(connection).recordLogin(staff.id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  attempts.delete(key);
  const row = await staffSessionModel(connectDB).findActive(
    sessionId,
    staff.id,
  );
  if (!row) fail("Staff session could not be started.", 500);
  return { token, ...toResponse(row, sessionId) };
}

export async function verifyStaffSession(token) {
  const { staffId, sessionId } = validateStaffToken(token);
  const row = await staffSessionModel(connectDB).findActive(sessionId, staffId);
  if (!row) fail("Your management session has ended. Sign in again.");
  return toResponse(row, sessionId);
}

export async function recordStaffActivity(token) {
  const { staffId, sessionId } = validateStaffToken(token);
  const model = staffSessionModel(connectDB);
  if (!(await model.recordActivity(sessionId, staffId))) {
    fail("Your management session has ended. Sign in again.");
  }
  return verifyStaffSession(token);
}

export async function reauthenticateStaff(
  token,
  password,
  remoteAddress = "unknown",
) {
  const { staffId, sessionId } = validateStaffToken(token);
  await verifyStaffSession(token);
  const key = `reauth:${remoteAddress}:${sessionId}`;
  enforceAttemptLimit(key);
  const hash = await staffModel(connectDB).findActivePasswordHashById(staffId);
  const valid =
    typeof password === "string" &&
    password.length > 0 &&
    hash &&
    (await bcrypt.compare(password, hash));
  if (!valid) {
    recordFailedAttempt(key);
    fail("Incorrect password.");
  }
  if (
    !(await staffSessionModel(connectDB).recordReauthentication(
      sessionId,
      staffId,
    ))
  ) {
    fail("Your management session has ended. Sign in again.");
  }
  attempts.delete(key);
  return verifyStaffSession(token);
}

export async function revokeStaffSession(token) {
  if (!token) return;
  try {
    const { staffId, sessionId } = validateStaffToken(token, {
      ignoreExpiration: true,
    });
    await staffSessionModel(connectDB).revoke(sessionId, staffId);
  } catch (error) {
    // Invalid/expired tokens cannot authenticate anything. Never skip a database error.
    if (error.status !== 401) throw error;
  }
}
