import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";

import { customerModel } from "../../../models/customer/auth/authModel.js";

import { registrationOtpModel } from "../../../models/customer/auth/registrationOtpModel.js";

import {
  validateOtpRegistration,
  validateOtpVerification,
} from "../../../validators/customer/auth/registrationOtpValidator.js";

import { sendRegistrationOtpEmail } from "./registrationOtpMailer.js";

const MINUTE = 60_000;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function digest(value) {
  const secret = process.env.REGISTRATION_OTP_SECRET;

  if (!secret || !process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    fail("Registration verification is not configured.", 503);
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function time(milliseconds) {
  return new Date(milliseconds);
}

/**
 * Step 1:
 * Validate registration information.
 * Save pending registration in MySQL.
 * Send the six-digit verification code.
 */
export async function requestCustomerRegistrationOtp(body, ip = "unknown") {
  const data = validateOtpRegistration(body);

  if (!process.env.RESEND_API_KEY || !process.env.REGISTRATION_EMAIL_FROM) {
    fail(
      "Email verification is not available. Contact the administrator.",
      503,
    );
  }

  const now = Date.now();

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const otpHash = digest(`${data.email}:${code}`);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const ipHash = digest(`request-ip:${String(ip).slice(0, 128)}`);

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const users = customerModel(db);
    const pendingModel = registrationOtpModel(db);

    const existing = await users.findUserByEmail(data.email);

    if (existing[0].length) {
      fail("This email is already registered. Please log in.", 409);
    }

    const pending = await pendingModel.lockPending(data.email);

    if (pending && new Date(pending.resendAfter).getTime() > now) {
      fail("Please wait one minute before requesting another code.", 429);
    }

    const sameHour =
      pending &&
      now - new Date(pending.windowStartedAt).getTime() < 60 * MINUTE;

    const sendsInWindow = sameHour ? Number(pending.sendsInWindow) + 1 : 1;

    if (sendsInWindow > 5) {
      fail("Too many codes requested. Try again in one hour.", 429);
    }

    const ipRequests = await pendingModel.countIpRequest(ipHash, time(now));

    if (ipRequests > 20) {
      fail(
        "Too many verification requests from this connection. Try again later.",
        429,
      );
    }

    await pendingModel.savePending({
      ...data,
      passwordHash,
      otpHash,
      expiresAt: time(now + 10 * MINUTE),
      resendAfter: time(now + MINUTE),
      windowStartedAt: sameHour ? pending.windowStartedAt : time(now),
      sendsInWindow,
    });

    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }

  try {
    await sendRegistrationOtpEmail(data.email, code);
  } catch (error) {
    // Remove the unsent code without deleting
    // any newer verification request.
    await registrationOtpModel(connectDB).deleteUnsent(data.email, otpHash);

    throw error;
  }

  return {
    message:
      "We sent a 6-digit verification code to your email. It expires in 10 minutes.",
  };
}

/**
 * Step 2:
 * Check the email verification code.
 * Create the customer account in MySQL.
 * Return login tokens after verification.
 */
export async function verifyCustomerRegistrationOtp(body) {
  const { email, otp } = validateOtpVerification(body);

  const supplied = Buffer.from(digest(`${email}:${otp}`), "hex");

  const db = await connectDB.getConnection();

  let committed = false;

  try {
    await db.beginTransaction();

    const pendingModel = registrationOtpModel(db);
    const users = customerModel(db);

    const pending = await pendingModel.lockPending(email);

    if (!pending) {
      fail("No pending registration. Please register again.", 404);
    }

    if (new Date(pending.expiresAt).getTime() <= Date.now()) {
      fail("The code has expired. Request a new verification code.", 410);
    }

    if (Number(pending.failedAttempts) >= 5) {
      fail("Too many incorrect attempts. Request a new code.", 429);
    }

    const expected = Buffer.from(pending.otpHash, "hex");

    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      await pendingModel.recordFailure(email);

      await db.commit();
      committed = true;

      fail("Incorrect verification code. Check your email and try again.", 400);
    }

    const existing = await users.findUserByEmail(email);

    if (existing[0].length) {
      fail("This email is already registered. Please log in.", 409);
    }

    const [created] = await users.createUser(
      pending.fullName,
      email,
      "CUSTOMER",
      pending.passwordHash,
      null,
      "ACTIVE",
    );

    if (!created.insertId) {
      throw new Error("Account could not be created.");
    }

    await users.createCustomer(created.insertId, pending.phone, "ACTIVE");

    await pendingModel.deletePending(email);

    await db.commit();
    committed = true;

    const claims = {
      sub: String(created.insertId),
      accountType: "CUSTOMER",
      role: null,
      sessionVersion: 0,
    };

    return {
      message: "Email verified. Your account is ready.",

      accessToken: jwt.sign(claims, process.env.ACCESS_SECRET, {
        expiresIn: "15m",
      }),

      refreshToken: jwt.sign(claims, process.env.REFRESH_SECRET, {
        expiresIn: "7d",
      }),

      user: {
        userId: created.insertId,
        name: pending.fullName,
        email,
        accountType: "CUSTOMER",
      },
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
