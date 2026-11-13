import bcrypt from "bcrypt";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";

import { passwordResetModel } from "../../../models/customer/auth/passwordResetModel.js";

import {
  validateResetConfirmation,
  validateResetRequest,
} from "../../../validators/customer/auth/passwordResetValidator.js";

import { sendPasswordResetEmail } from "./passwordResetMailer.js";

const MINUTE = 60_000;

const PUBLIC_MESSAGE =
  "If this is an active customer email, a six-digit code will be sent. Please check your inbox.";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function hash(part) {
  if (!process.env.REGISTRATION_OTP_SECRET) {
    fail("Password reset is not configured.", 503);
  }

  return createHmac("sha256", process.env.REGISTRATION_OTP_SECRET)
    .update(part)
    .digest("hex");
}

function date(ms) {
  return new Date(ms);
}

export async function requestPasswordReset(body, ip = "unknown") {
  const { email } = validateResetRequest(body);

  const now = Date.now();

  const ipHash = hash(`reset-ip:${String(ip).slice(0, 128)}`);

  const db = await connectDB.getConnection();

  let toSend = null;
  let codeHash = null;

  try {
    await db.beginTransaction();

    const model = passwordResetModel(db);

    const ipCount = await model.countIp(ipHash, date(now));

    if (ipCount > 20) {
      fail("Too many requests from this connection. Please try later.", 429);
    }

    const user = await model.findActiveCustomer(email);

    if (user) {
      const prior = await model.lockExisting(email);

      const inHour =
        prior && now - new Date(prior.windowStartedAt).getTime() < 60 * MINUTE;

      const sends = inHour ? Number(prior.sendsInWindow) + 1 : 1;

      if (prior && new Date(prior.resendAfter).getTime() > now) {
        fail("Please wait one minute before requesting another code.", 429);
      }

      if (sends > 5) {
        fail("Too many codes requested. Try again in one hour.", 429);
      }

      toSend = String(randomInt(0, 1_000_000)).padStart(6, "0");

      codeHash = hash(`password-reset:${email}:${toSend}`);

      await model.saveCode({
        email,
        userId: user.id,
        codeHash,
        expiresAt: date(now + 10 * MINUTE),
        resendAfter: date(now + MINUTE),
        windowStartedAt: inHour ? prior.windowStartedAt : date(now),
        sends,
      });
    }

    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }

  if (toSend) {
    try {
      await sendPasswordResetEmail(email, toSend);
    } catch (error) {
      await passwordResetModel(connectDB).discardUnsent(email, codeHash);

      throw error;
    }
  }

  return {
    message: PUBLIC_MESSAGE,
  };
}

export async function confirmPasswordReset(body) {
  const { email, code, newPassword } = validateResetConfirmation(body);

  const provided = Buffer.from(hash(`password-reset:${email}:${code}`), "hex");

  const db = await connectDB.getConnection();

  let committed = false;

  try {
    await db.beginTransaction();

    const model = passwordResetModel(db);

    const pending = await model.lockExisting(email);

    if (!pending || new Date(pending.expiresAt).getTime() <= Date.now()) {
      fail("Code expired or invalid. Request a new code.", 400);
    }

    if (Number(pending.failedAttempts) >= 5) {
      fail("Too many incorrect codes. Request a new code.", 429);
    }

    const expected = Buffer.from(pending.codeHash, "hex");

    if (!timingSafeEqual(expected, provided)) {
      await model.incrementAttempts(email);

      await db.commit();
      committed = true;

      fail("Incorrect code. Check your email and try again.", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    if ((await model.updatePassword(pending.userId, passwordHash)) !== 1) {
      fail("Account unavailable. Request a new code.", 409);
    }

    await model.deleteCode(email);

    await db.commit();
    committed = true;

    return {
      message: "Password changed. Sign in again using your new password.",
    };
  } catch (error) {
    if (!committed) {
      await db.rollback();
    }

    throw error;
  } finally {
    db.release();
  }
}
