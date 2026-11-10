import connectDB from "../../../utils/dbConn.js";
import {
  reserveAppointment,
  releaseAppointment,
} from "../../scheduling/bookingScheduleService.js";
import { customerServiceModel } from "../../../models/customer/account/serviceModel.js";
import { createCustomerNotification } from "../notification/notificationService.js";

import {
  validateCustomerUserId,
  validateServiceChange,
  validateServiceDestination,
} from "../../../validators/customer/serviceValidator.js";

function serviceError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function getActiveCustomerId(model, userId) {
  const [customers] = await model.findCustomerByUserId(userId);
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

  return customer.customerId;
}

export async function getMyServicesService(userId) {
  const validatedUserId = validateCustomerUserId(userId);
  const connection = await connectDB.getConnection();

  try {
    const model = customerServiceModel(connection);

    const customerId = await getActiveCustomerId(model, validatedUserId);

    const [services] = await model.findMyServicesByCustomerId(customerId);

    return services.map((service) => {
      const hasWorkOrder = Boolean(Number(service.hasWorkOrder));

      const canChange = service.status === "PENDING" && !hasWorkOrder;

      return {
        ...service,
        canEdit: canChange,
        canCancel: canChange,
        canDelete: service.status === "CANCELLED" && !hasWorkOrder,
      };
    });
  } finally {
    connection.release();
  }
}

export async function changeMyServiceService(userId, requestId, action, input) {
  const validatedUserId = validateCustomerUserId(userId);

  const change = validateServiceChange(requestId, action, input);

  const connection = await connectDB.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const model = customerServiceModel(connection);

    const customerId = await getActiveCustomerId(model, validatedUserId);

    const [requests] = await model.lockRequest(customerId, change.requestId);

    const request = requests[0];

    if (!request) {
      throw serviceError("Service request not found.", 404);
    }

    if (request.revision !== change.data.revision) {
      throw serviceError(
        "This request has changed. Close this dialog, refresh the list, and try again.",
        409,
      );
    }

    const [workOrders] = await model.lockWorkOrders(change.requestId);

    if (workOrders.length > 0) {
      throw serviceError(
        "This service is already being handled. Contact AV Cooling for changes.",
        409,
      );
    }

    if (change.action === "delete") {
      if (request.status !== "CANCELLED") {
        throw serviceError("Only cancelled requests can be removed.", 409);
      }

      await model.hideRequest(customerId, change.requestId);
    } else {
      if (request.status !== "PENDING") {
        throw serviceError(
          "Only pending requests can be edited or cancelled. Contact AV Cooling for assistance.",
          409,
        );
      }

      if (change.action === "cancel") {
        await model.cancelRequest(customerId, change.requestId);
        await releaseAppointment(connection, "SERVICE", change.requestId);
        await createCustomerNotification(
          connection,
          validatedUserId,
          "SERVICE_CANCELLED_BY_CUSTOMER",
          "Service request cancelled",
          `You cancelled service request #${change.requestId}.`,
          `/account/services/${change.requestId}`,
        );
      } else {
        const destinationAddress = validateServiceDestination(
          request.serviceType,
          change.data.destinationAddress,
        );

        await reserveAppointment(
          connection,
          "SERVICE",
          change.requestId,
          change.data.preferredStart,
        );
        await model.updateRequest(customerId, change.requestId, {
          ...change.data,
          destinationAddress,
        });
        await createCustomerNotification(
          connection,
          validatedUserId,
          "SERVICE_UPDATED",
          "Service request updated",
          `You updated the details of service request #${change.requestId}.`,
          `/account/services/${change.requestId}`,
        );
      }
    }

    await connection.commit();
    transactionStarted = false;

    return {
      requestId: change.requestId,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Service transaction rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
