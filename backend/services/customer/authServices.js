import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import connectDB from "../../utils/dbConn.js";
import { customerModel } from "../../models/customer/customerModel.js";
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

export async function registerCustomerService(input) {
  /**
   * *  Validate the registration data.
   */
  const validation = validateRegister(input);

  //validation.errors?.join(" ") -  It combines validation errors into one readable message for the frontend.
  if (!validation.success) {
    const error = new Error(
      validation.errors?.join(" ") || "Invalid registration data.",
    );
    error.status = 400;
    throw error;
  }

  const { fullName, email, phone, password } = validation.data;

  /**
   **  Check required fields.
   */
  //
  if (!fullName || !email || !phone || !password) {
    const error = new Error("All required fields must be provided.");
    error.status = 400;
    throw error;
  }

  /**
   **  Ensure JWT secrets are configured.
   */
  if (!process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    throw new Error("Authentication secrets are not configured.");
  }

  //gets an available db connection from connection pool
  const connection = await connectDB.getConnection();

  try {
    //start transaction useful when multiple related database changes must succeed or fail together.
    await connection.beginTransaction();

    const customer = customerModel(connection);

    /**
     **  Check whether the email is already registered.
     */
    const [existingUsers] = await customer.findUserByEmail(email);

    if (existingUsers.length > 0) {
      const error = new Error("Email is already registered.");
      error.status = 409;
      throw error;
    }

    /**
     **  Hash the password before storing it.
     */
    const passwordHash = await hashPassword(password);

    /**
     **  Create the main user account.
     */
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

    /**
     **  Create the customer profile linked to the user.
     */
    const [customerResult] = await customer.createCustomer(
      userId,
      phone,
      "ACTIVE",
    );

    if (customerResult.affectedRows !== 1) {
      throw new Error("Failed to create customer profile.");
    }

    /**
     **  Create authentication tokens.
     */
    const payload = {
      userId,
      fullName,
      accountType: "CUSTOMER",
      role: null,
    };

    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);

    //Save both database records together.
    await connection.commit();

    return {
      message: "Registration successful.",
      accessToken,
      refreshToken,
      user: {
        userId,
        fullName,
        email,
        phone,
        accountType: "CUSTOMER",
        role: null,
      },
    };
  } catch (error) {
    //Cancels all uncommitted changes made during the current transaction.
    await connection.rollback();
    throw error;
  } finally {
    //returns the connection to the pool so another query can reuse it.
    connection.release();
  }
}

export async function loginCustomerService(input) {
  const validation = validateLogin(input);

  if (!validation.success) {
    const error = new Error(
      validation.errors?.join(" ") || "Invalid login data.",
    );
    error.status = 400;
    throw error;
  }

  const { email, password } = validation.data;

  if (!email || !password) {
    const error = new Error("All required fields must be provided.");
    error.status = 400;
    throw error;
  }

  if (!process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
    throw new Error("Authentication secrets are not configured.");
  }

  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();

    const customer = customerModel(connection);

    const [existingUsers] = await customer.findUserByEmail(email);

    const existingUser = existingUsers[0];

    if (!existingUser) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      throw error;
    }
    const { user_id, name, password_hash, role, status, account_type } =
      existingUser;

    const isPasswordValid = await verifyPassword(password, password_hash);

    if (!isPasswordValid) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      throw error;
    }

    if (status !== "ACTIVE") {
      const error = new Error("Your account is inactive.");
      error.status = 403;
      throw error;
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
    //returns the connection to the pool so another query can reuse it.
    connection.release();
  }
}
