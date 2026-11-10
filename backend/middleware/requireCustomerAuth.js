import jwt from "jsonwebtoken";

import connectDB from "../utils/dbConn.js";

import { customerModel } from "../models/customer/auth/authModel.js";

export async function requireCustomerAuth(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!process.env.ACCESS_SECRET) {
    console.error("ACCESS_SECRET is not configured.");

    return res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }

  const userId = Number(payload.sub ?? payload.userId ?? payload.user_id);

  const accountType = String(
    payload.accountType ?? payload.account_type ?? "",
  ).toUpperCase();

  const sessionVersion = payload.sessionVersion ?? 0;

  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !Number.isSafeInteger(sessionVersion) ||
    sessionVersion < 0
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid customer session.",
    });
  }

  if (accountType !== "CUSTOMER") {
    return res.status(403).json({
      success: false,
      message: "Customer access is required.",
    });
  }

  try {
    const current =
      await customerModel(connectDB).findCustomerSessionById(userId);

    if (!current || sessionVersion !== Number(current.sessionVersion)) {
      return res.status(401).json({
        success: false,
        message: "Your session has ended. Sign in again.",
      });
    }

    if (
      current.userStatus !== "ACTIVE" ||
      current.customerStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your customer account is inactive.",
      });
    }

    req.auth = {
      userId: String(userId),
      accountType: "CUSTOMER",
      role: null,
    };

    return next();
  } catch (error) {
    console.error("Customer session verification failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify your session.",
    });
  }
}
