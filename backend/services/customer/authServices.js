import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import connectDB from "../../utils/dbConn.js";
import { customerModel } from "../../models/customer/authModel.js";
import {
  validateRegister,
  validateLogin,
} from "../../utils/validateAndSanitize.js";

const hashPassword = (password) => bcrypt.hash(password, 12);

const verifyPassword = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);

const createAccessToken = (payload) =>
  jwt.sign(payload, process.env.ACCESS_SECRET, {
    expiresIn: "15m",
  });

const createRefreshToken = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
  });

function createAuthError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function registerCustomerService(input) {
  const validation = validateRegister(input);

  if (!validation.success) {
    throw createAuthError(
      validation.errors?.join(" ") || "Invalid registration data.",
      400,
    );
  }

  const { fullName, email, phone, password } = validation.data;

  if (!fullName || !email || !phone || !password) {
    throw createAuthError("All required fields must be provided.", 400);
  }

  if (!process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    throw new Error("Authentication secrets are not configured.");
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const customer = customerModel(connection);
    const [existingUsers] = await customer.findUserByEmail(email);

    if (existingUsers.length > 0) {
      throw createAuthError("Email is already registered.", 409);
    }

    const passwordHash = await hashPassword(password);

    const [userResult] = await customer.createUser(
      fullName,
      email,
      "CUSTOMER",
      passwordHash,
      null,
      "ACTIVE",
    );

    if (userResult.affectedRows !== 1) {
      throw new Error("Failed to create user account.");
    }

    const userId = userResult.insertId;

    const [customerResult] = await customer.createCustomer(
      userId,
      phone,
      "ACTIVE",
    );

    if (customerResult.affectedRows !== 1) {
      throw new Error("Failed to create customer profile.");
    }

    const payload = {
      sub: String(userId),
      accountType: "CUSTOMER",
      role: null,
    };

    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);

    await connection.commit();

    return {
      message: "Registration successful.",
      accessToken,
      refreshToken,
      user: {
        userId,
        name: fullName,
        email,
        phone,
        accountType: "CUSTOMER",
        role: null,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function loginCustomerService(input) {
  const validation = validateLogin(input);

  if (!validation.success) {
    throw createAuthError(
      validation.errors?.join(" ") || "Invalid login data.",
      400,
    );
  }

  const { email, password } = validation.data;

  if (!email || !password) {
    throw createAuthError("All required fields must be provided.", 400);
  }

  if (!process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    throw new Error("Authentication secrets are not configured.");
  }

  const connection = await connectDB.getConnection();

  try {
    const customer = customerModel(connection);
    const [existingUsers] = await customer.findUserByEmail(email);
    const existingUser = existingUsers[0];

    if (!existingUser) {
      throw createAuthError("Invalid email or password.");
    }

    const { user_id, name, password_hash, role, status, account_type } =
      existingUser;

    const isPasswordValid = await verifyPassword(password, password_hash);

    if (!isPasswordValid) {
      throw createAuthError("Invalid email or password.");
    }

    if (status !== "ACTIVE") {
      throw createAuthError("Your account is inactive.", 403);
    }

    if (account_type !== "CUSTOMER") {
      throw createAuthError("Customer access is required.", 403);
    }

    const payload = {
      sub: String(user_id),
      role,
      accountType: account_type,
    };

    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);

    return {
      message: "Login successful.",
      accessToken,
      refreshToken,
      user: {
        userId: user_id,
        name,
        email: existingUser.email,
        role,
        status,
        accountType: account_type,
      },
    };
  } finally {
    connection.release();
  }
}

export async function refreshCustomerSessionService(refreshToken) {
  if (!refreshToken) {
    throw createAuthError("Refresh token is missing.");
  }

  if (!process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    throw new Error("Authentication secrets are not configured.");
  }

  let payload;

  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  } catch {
    throw createAuthError("Your session has expired. Please log in again.");
  }

  const userId = payload.sub ?? payload.userId ?? payload.user_id;

  const accountType = String(
    payload.accountType ?? payload.account_type ?? "",
  ).toUpperCase();

  const numericUserId = Number(userId);

  if (
    !Number.isSafeInteger(numericUserId) ||
    numericUserId <= 0 ||
    accountType !== "CUSTOMER"
  ) {
    throw createAuthError("Invalid customer refresh token.");
  }

  const connection = await connectDB.getConnection();

  try {
    const customer = customerModel(connection);

    const [users] = await customer.findUserById(numericUserId);
    const user = users[0];

    if (!user) {
      throw createAuthError("Customer account not found.");
    }

    if (user.status !== "ACTIVE" || user.customer_status !== "ACTIVE") {
      throw createAuthError("Your customer account is inactive.", 403);
    }

    const accessToken = createAccessToken({
      sub: String(user.user_id),
      role: user.role,
      accountType: user.account_type,
    });

    return { accessToken };
  } finally {
    connection.release();
  }
}
