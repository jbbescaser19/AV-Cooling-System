import bcrypt from "bcrypt";

import connectDB from "../../../utils/dbConn.js";

import { customerModel } from "../../../models/customer/auth/authModel.js";

import { validatePasswordChange } from "../../../validators/customer/account/passwordValidator.js";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;

  throw error;
}

export async function changeCustomerPassword(userId, rawInput) {
  const details = validatePasswordChange(rawInput);

  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid customer session.", 401);
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = customerModel(connection);

    const customer = await model.lockActiveCustomerForPasswordChange(id);

    if (!customer) {
      fail("Active customer account required.", 403);
    }

    const currentMatches = await bcrypt.compare(
      details.currentPassword,
      customer.passwordHash,
    );

    if (!currentMatches) {
      fail("Your current password is incorrect.", 400);
    }

    const isSamePassword = await bcrypt.compare(
      details.newPassword,
      customer.passwordHash,
    );

    if (isSamePassword) {
      fail("Choose a different new password.", 400);
    }

    const newHash = await bcrypt.hash(details.newPassword, 12);

    const changed = await model.updateCustomerPassword(
      id,
      newHash,
      customer.sessionVersion,
      details.signOutAllDevices,
    );

    if (changed !== 1) {
      fail("Password could not be updated. Please retry.", 409);
    }

    await connection.commit();

    return {
      signOutAllDevices: details.signOutAllDevices,

      message: details.signOutAllDevices
        ? "Password updated. All devices have been signed out. Sign in with your new password."
        : "Password updated. Your existing sessions are still signed in.",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
