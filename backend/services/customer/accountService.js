import connectDB from "../../utils/dbConn.js";
import { customerAccountModel } from "../../models/customer/accountModel.js";

export async function getCustomerProfileService(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("Invalid customer ID.");
    error.status = 401;
    throw error;
  }

  const connection = await connectDB.getConnection();

  try {
    const account = customerAccountModel(connection);
    const [rows] = await account.findProfileByUserId(id);
    const profile = rows[0];

    if (!profile) {
      const error = new Error("Customer account not found.");
      error.status = 404;
      throw error;
    }

    if (profile.status !== "ACTIVE" || profile.customerStatus !== "ACTIVE") {
      const error = new Error("Your customer account is inactive.");
      error.status = 403;
      throw error;
    }

    return {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      status: profile.status,
      accountType: profile.accountType,
    };
  } finally {
    connection.release();
  }
}
