import { z } from "zod";

import connectDB from "../../../utils/dbConn.js";
import { serviceRequestModel } from "../../../models/customer/services/serviceRequestModel.js";

const requestSchema = z.strictObject({
  serviceType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,39}$/),

  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),

  serviceAddress: z.string().trim().min(5).max(2000),

  destinationAddress: z.string().trim().max(2000).nullable().optional(),

  concern: z.string().trim().max(3000).optional(),

  notes: z.string().trim().max(3000).optional(),
});

function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getUserId(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw requestError("Invalid customer session.", 401);
  }

  return id;
}

function preferredStartForMySQL(date, time) {
  const [year, month, day] = date.split("-").map(Number);

  const validDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(validDate.getTime()) ||
    validDate.toISOString().slice(0, 10) !== date
  ) {
    throw requestError("Select a valid preferred date.");
  }

  const requestedAt = Date.parse(`${date}T${time}:00+08:00`);

  if (!Number.isFinite(requestedAt) || requestedAt <= Date.now()) {
    throw requestError("Choose a future preferred date and time.");
  }

  return `${date} ${time}:00`;
}

async function getActiveCustomer(model, userId) {
  const [rows] = await model.findCustomerByUserId(userId);

  const customer = rows[0];

  if (!customer) {
    throw requestError("Customer account not found.", 404);
  }

  if (
    customer.userStatus !== "ACTIVE" ||
    customer.customerStatus !== "ACTIVE"
  ) {
    throw requestError("Your customer account is inactive.", 403);
  }

  return customer;
}

export async function getActiveServiceTypesService() {
  const model = serviceRequestModel(connectDB);

  const [services] = await model.findActiveServices();

  return services;
}

export async function createServiceRequestService(userId, input) {
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    throw requestError("Invalid service request details.", 400);
  }

  const data = parsed.data;

  const preferredStart = preferredStartForMySQL(
    data.preferredDate,
    data.preferredTime,
  );

  const connection = await connectDB.getConnection();

  try {
    const model = serviceRequestModel(connection);

    const customer = await getActiveCustomer(model, getUserId(userId));

    // MySQL determines which services exist and are active.
    const [services] = await model.findActiveServiceByCode(data.serviceType);

    const selectedService = services[0];

    if (!selectedService) {
      throw requestError(
        "This service is unavailable. Please select another service.",
        422,
      );
    }

    if (!String(customer.contactNumber ?? "").trim()) {
      throw requestError("Please add a contact number to your account.", 409);
    }

    const isRelocation = data.serviceType === "relocation";

    const destinationAddress = isRelocation
      ? (data.destinationAddress || "").trim()
      : null;

    if (isRelocation && !destinationAddress) {
      throw requestError("Enter the relocation destination address.");
    }

    // Use the actual service ID and price from the database.
    const basePrice = String(selectedService.basePrice);

    const [result] = await model.createRequest({
      customerId: customer.customerId,
      serviceTypeId: selectedService.serviceTypeId,
      servicePrice: basePrice,
      preferredStart,
      contactNumber: customer.contactNumber,
      serviceAddress: data.serviceAddress,
      destinationAddress,
      concern: data.concern || null,
      notes: data.notes || null,
    });

    return {
      requestId: result.insertId,
      serviceType: data.serviceType,
      serviceName: selectedService.serviceName,
      estimatedBasePrice: basePrice,
      preferredStart,
      status: "PENDING",
    };
  } finally {
    connection.release();
  }
}

export async function getCustomerServiceRequestsService(userId) {
  const model = serviceRequestModel(connectDB);

  const customer = await getActiveCustomer(model, getUserId(userId));

  const [requests] = await model.findRequestsByCustomerId(customer.customerId);

  return requests;
}
