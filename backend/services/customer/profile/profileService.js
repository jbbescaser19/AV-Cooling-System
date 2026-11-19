import connectDB from "../../../utils/dbConn.js";

import { customerAccountModel } from "../../../models/customer/account/profileModel.js";

import { validateProfileUpdate } from "../../../validators/customer/account/profileValidator.js";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function validateUserId(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    fail("Invalid customer ID.", 401);
  }

  return id;
}

function requireActiveProfile(profile) {
  if (!profile) {
    fail("Customer account not found.", 404);
  }

  if (profile.status !== "ACTIVE" || profile.customerStatus !== "ACTIVE") {
    fail("Your customer account is inactive.", 403);
  }

  return profile;
}

function formatProfile(profile) {
  return {
    userId: profile.userId,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    status: profile.status,
    accountType: profile.accountType,
  };
}

export async function getCustomerProfileService(userId) {
  const id = validateUserId(userId);

  const connection = await connectDB.getConnection();

  try {
    const account = customerAccountModel(connection);

    const [rows] = await account.findProfileByUserId(id);

    const profile = requireActiveProfile(rows[0]);

    return formatProfile(profile);
  } finally {
    connection.release();
  }
}

export async function updateCustomerProfileService(userId, input) {
  const id = validateUserId(userId);

  const details = validateProfileUpdate(input);

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const account = customerAccountModel(connection);

    const [rows] = await account.lockProfileByUserId(id);

    const current = requireActiveProfile(rows[0]);

    if (current.name !== details.name || current.phone !== details.phone) {
      const [result] = await account.updateProfile(
        id,
        details.name,
        details.phone,
      );

      if (result.affectedRows < 1) {
        fail("Unable to update your profile. Please try again.", 409);
      }
    }

    const [updatedRows] = await account.findProfileByUserId(id);

    const updatedProfile = requireActiveProfile(updatedRows[0]);

    await connection.commit();

    return formatProfile(updatedProfile);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
