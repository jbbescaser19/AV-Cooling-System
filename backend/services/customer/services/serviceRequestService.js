import { quoteService } from "../../shared/serviceQuotationService.js";
import connectDB from "../../../utils/dbConn.js";
import { createCustomerNotification } from "../notification/notificationService.js";
import { workspaceModel } from "../../../models/management/workspaceModel.js";
import { serviceRequestModel } from "../../../models/customer/services/serviceRequestModel.js";
import { airconPurchaseModel } from "../../../models/customer/services/airconPurchaseModel.js";
import { validateNewServiceRequest } from "../../../validators/customer/serviceValidator.js";
import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";
import { assertServicePaymentAvailable } from "./servicePaymentService.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { parseBookingStart } from "../../../validators/scheduling/bookingScheduleValidator.js";

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
  return parseBookingStart(`${date}T${time}`).sql;
}

async function getActiveCustomer(model, userId, lock = false) {
  const [rows] = await model.findCustomerByUserId(userId, lock);
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
  const [services] = await serviceRequestModel(connectDB).findActiveServices();
  return services;
}

function mapAirconPurchase(item) {
  // A completed order is a recorded fulfillment outcome even when older
  // orders do not have a separate ORDER_DELIVERED event.
  const delivered =
    item.orderStatus === "COMPLETED" ||
    (item.fulfillmentMethod === "DELIVERY" &&
      Boolean(Number(item.deliveryConfirmed)));
  const installationEligible =
    delivered &&
    !Boolean(Number(item.installationIncluded)) &&
    Number(item.installationBookedCount) < Number(item.quantity);

  return {
    orderItemId: Number(item.orderItemId),
    orderNumber: item.orderNumber,
    orderStatus: item.orderStatus,
    label: `${item.orderNumber} · ${item.brand} ${item.model} · ${Number(item.horsepower)} HP`,
    brand: item.brand,
    model: item.model,
    horsepower: Number(item.horsepower),
    delivered,
    installationIncluded: Boolean(Number(item.installationIncluded)),
    installationEligible,
  };
}

export async function getCustomerAirconPurchasesService(userId) {
  const customer = await getActiveCustomer(
    serviceRequestModel(connectDB),
    getUserId(userId),
  );
  const [items] = await airconPurchaseModel(
    connectDB,
  ).findCustomerPurchasedUnits(customer.customerId);
  return items.map(mapAirconPurchase);
}

// Existing endpoint is retained for older clients, but the new booking form uses /aircon-purchases.
export async function getInstallationProductsService(userId) {
  const products = await getCustomerAirconPurchasesService(userId);
  return products.filter((item) => item.installationEligible);
}

export async function createServiceRequestService(userId, input) {
  const data = validateNewServiceRequest(input);
  assertServicePaymentAvailable(data.paymentCode);
  const preferredStart = preferredStartForMySQL(
    data.preferredDate,
    data.preferredTime,
  );
  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();
    const model = serviceRequestModel(connection);
    // Serializes this customer's concurrent installation submissions.
    const customer = await getActiveCustomer(model, getUserId(userId), true);
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

    if (isRelocation && destinationAddress.length < 5) {
      throw requestError("Enter the relocation destination address.");
    }

    let aircon;
    if (data.aircon.source === "PURCHASED") {
      const [rows] = await airconPurchaseModel(
        connection,
      ).findCustomerPurchasedUnits(
        customer.customerId,
        data.aircon.orderItemId,
      );
      const item = rows[0] ? mapAirconPurchase(rows[0]) : null;

      if (!item || !item.delivered) {
        throw requestError(
          "This aircon purchase is not delivered or is no longer available. Select a delivered purchase or enter a unit you own.",
          409,
        );
      }
      if (data.serviceType === "installation" && !item.installationEligible) {
        throw requestError(
          "Installation is already included or booked for this aircon. Use the installation in your order instead.",
          409,
        );
      }
      aircon = {
        source: "PURCHASED",
        orderItemId: item.orderItemId,
        brand: item.brand,
        model: item.model,
        horsepower: item.horsepower,
      };
    } else {
      aircon = {
        source: "CUSTOMER_OWNED",
        orderItemId: null,
        brand: data.aircon.brand,
        model: data.aircon.model,
        horsepower: data.aircon.horsepower,
      };
    }

    const quote = quoteService({
      code: data.serviceType,
      basePrice: selectedService.basePrice,
      copperFeet: data.copperFeet,
      includeDismantling: data.includeDismantling,
    });
    const basePrice = quote.total.toFixed(2);
    const [result] = await model.createRequest({
      customerId: customer.customerId,
      serviceTypeId: selectedService.serviceTypeId,
      servicePrice: basePrice,
      copperFeet: data.copperFeet,
      includeDismantling: data.includeDismantling,
      preferredStart,
      contactNumber: customer.contactNumber,
      serviceAddress: data.serviceAddress,
      destinationAddress,
      concern: data.concern || null,
      notes: data.notes || null,
      aircon,
    });

    await reserveAppointment(
      connection,
      "SERVICE",
      result.insertId,
      preferredStart,
    );
    await servicePaymentModel(connection).createPending(
      result.insertId,
      data.paymentCode,
      basePrice,
    );

    await createCustomerNotification(
      connection,
      userId,
      "SERVICE_REQUESTED",
      "Service request received",
      `Your ${selectedService.serviceName} request #${result.insertId} was received. The preferred schedule is pending confirmation.`,
      `/account/services/${result.insertId}`,
    );
    await workspaceModel(connection).notifyStaff(
      "New service request",
      `${selectedService.serviceName} request #${result.insertId} is waiting for review.`,
      ["OWNER", "MANAGER"],
    );
    await connection.commit();

    return {
      requestId: result.insertId,
      serviceType: data.serviceType,
      serviceName: selectedService.serviceName,
      estimatedBasePrice: basePrice,
      paymentCode: data.paymentCode,
      paymentStatus: "PENDING",
      preferredStart,
      aircon,
      status: "PENDING",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
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
