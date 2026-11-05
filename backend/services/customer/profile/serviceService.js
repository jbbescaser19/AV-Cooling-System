import connectDB from "../../../utils/dbConn.js";
import { customerServiceModel } from "../../../models/customer/account/serviceModel.js";

function serviceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getMyServicesService(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw serviceError("Invalid customer session.", 401);
  }

  const connection = await connectDB.getConnection();

  try {
    const model = customerServiceModel(connection);
    const [customers] = await model.findCustomerByUserId(id);
    const customer = customers[0];

    if (!customer) {
      throw serviceError("Customer account not found.", 404);
    }

    if (
      customer.userStatus !== "ACTIVE" ||
      customer.customerStatus !== "ACTIVE"
    ) {
      throw serviceError("Your customer account is inactive.", 403);
    }

    const [services] = await model.findMyServicesByCustomerId(
      customer.customerId,
    );

    return services;
  } finally {
    connection.release();
  }
}
