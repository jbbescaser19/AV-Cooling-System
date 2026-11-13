import bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import connectDB from "../../utils/dbConn.js";
import { staffModel } from "../../models/management/staffModel.js";
import { staffSessionModel } from "../../models/management/staffSessionModel.js";

export const STAFF_ACCESS_MS = 15 * 60 * 1000;
export const STAFF_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const STAFF_REAUTH_MS = 10 * 60 * 1000;

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

const SID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REFRESH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

function fail(message, status = 401) {
  throw Object.assign(new Error(message), { status });
}

function enforceAttemptLimit(key) {
  const now = Date.now();

  if (attempts.size >= 3000) {
    for (const [entryKey, item] of attempts) {
      if (now - item.start >= WINDOW_MS) {
        attempts.delete(entryKey);
      }
    }

    if (attempts.size >= 3000) {
      attempts.delete(attempts.keys().next().value);
    }
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

function mintAccessToken(staffId, sessionId) {
  if (!process.env.ACCESS_SECRET) {
    fail("Staff authentication is not configured.", 500);
  }

  const token = jwt.sign(
    {
      scope: "staff",
      sid: sessionId,
    },
    process.env.ACCESS_SECRET,
    {
      algorithm: "HS256",
      subject: String(staffId),
      expiresIn: "15m",
    },
  );

  const payload = jwt.decode(token);

  return {
    token,
    accessExpiresAt: Number(payload.exp) * 1000,
  };
}

function validateStaffToken(token, { ignoreExpiration = false } = {}) {
  if (!token) {
    fail("Management login required.");
  }

  if (!process.env.ACCESS_SECRET) {
    fail("Staff authentication is not configured.", 500);
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.ACCESS_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration,
    });
  } catch (error) {
    if (
      ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
        error.name,
      )
    ) {
      fail("Management access expired. Refresh your session or sign in again.");
    }

    throw error;
  }

  if (
    payload.scope !== "staff" ||
    !/^[1-9]\d*$/.test(String(payload.sub ?? "")) ||
    !SID_PATTERN.test(String(payload.sid ?? "")) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp - payload.iat > STAFF_ACCESS_MS / 1000 ||
    payload.exp <= payload.iat
  ) {
    fail("Invalid Management access token.");
  }

  return {
    staffId: Number(payload.sub),
    sessionId: payload.sid,
    accessExpiresAt: payload.exp * 1000,
  };
}

function createRefreshToken(sessionId) {
  return `${sessionId}.${randomBytes(32).toString("base64url")}`;
}

function parseRefreshToken(raw) {
  if (typeof raw !== "string") {
    fail("Management login required.");
  }

  const match = REFRESH_PATTERN.exec(raw);

  if (!match) {
    fail("Invalid Management refresh session.");
  }

  return {
    sessionId: match[1],
    refreshTokenHash: createHash("sha256").update(raw).digest("hex"),
  };
}

function sessionResponse(row, sessionId, accessExpiresAt) {
  return {
    staff: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      mustChangePassword: Boolean(row.mustChangePassword),
    },
    session: {
      id: sessionId,
      accessExpiresAt,
      refreshExpiresAt: Number(row.absoluteExpiresAt),
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

  const key = `login:${remoteAddress}:` + email.slice(0, 150);

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

  const sessionId = randomUUID();

  const refreshToken = createRefreshToken(sessionId);

  const refreshTokenHash = createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const { token, accessExpiresAt } = mintAccessToken(staff.id, sessionId);

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    await staffSessionModel(connection).create(
      sessionId,
      staff.id,
      refreshTokenHash,
    );

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

  if (!row) {
    fail("Management session could not be started.", 500);
  }

  return {
    token,
    refreshToken,
    ...sessionResponse(row, sessionId, accessExpiresAt),
  };
}

export async function verifyStaffSession(token) {
  const { staffId, sessionId, accessExpiresAt } = validateStaffToken(token);

  const row = await staffSessionModel(connectDB).findActive(sessionId, staffId);

  if (!row) {
    fail("Management session ended. Sign in again.");
  }

  return sessionResponse(row, sessionId, accessExpiresAt);
}

export async function refreshStaffSession(rawRefreshToken) {
  const { sessionId, refreshTokenHash } = parseRefreshToken(rawRefreshToken);

  const row = await staffSessionModel(connectDB).findActiveByRefresh(
    sessionId,
    refreshTokenHash,
  );

  if (!row) {
    fail("Management refresh session expired or was revoked. Sign in again.");
  }

  const { token, accessExpiresAt } = mintAccessToken(row.id, sessionId);

  return {
    token,
    ...sessionResponse(row, sessionId, accessExpiresAt),
  };
}

export async function recordStaffActivity(token) {
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
    typeof password === "string" && password.length > 0 && hash
      ? await bcrypt.compare(password, hash)
      : false;

  if (!valid) {
    recordFailedAttempt(key);

    fail("Incorrect password.", 403);
  }

  if (
    !(await staffSessionModel(connectDB).recordReauthentication(
      sessionId,
      staffId,
    ))
  ) {
    fail("Management session ended. Sign in again.");
  }

  attempts.delete(key);

  return verifyStaffSession(token);
}

export async function revokeStaffSession(accessToken, rawRefreshToken) {
  let revokedUsingRefresh = false;

  if (rawRefreshToken) {
    try {
      const { sessionId, refreshTokenHash } =
        parseRefreshToken(rawRefreshToken);

      revokedUsingRefresh = await staffSessionModel(connectDB).revokeByRefresh(
        sessionId,
        refreshTokenHash,
      );
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }
    }
  }

  if (accessToken && !revokedUsingRefresh) {
    try {
      const { staffId, sessionId } = validateStaffToken(accessToken, {
        ignoreExpiration: true,
      });

      await staffSessionModel(connectDB).revoke(sessionId, staffId);
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }
    }
  }
}
