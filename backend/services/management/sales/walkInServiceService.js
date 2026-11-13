import { quoteService } from "../../shared/serviceQuotationService.js";
import { cents, peso } from "./salesHelpers.js";
import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";
import connectDB from "../../../utils/dbConn.js";
import { walkInServiceModel } from "../../../models/management/sales/walkInServiceModel.js";
import { validateWalkInService } from "../../../validators/management/sales/walkInServiceValidator.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { ensureConfirmedWorkOrders } from "../services/confirmationWorkOrderService.js";
import { paymentMethodModel } from "../../../models/customer/order/paymentMethodModel.js";
import { paymongoConfigured } from "../../payments/paymongoService.js";

function deny(message, status = 403) {
  throw Object.assign(new Error(message), { status });
}
const staffAllowed = (staff) =>
  ["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff?.role);
export async function listWalkInServices(staff) {
  if (!staffAllowed(staff)) deny("POS access is required.");
  const [items, enabled] = await Promise.all([
    walkInServiceModel(connectDB).activeServices(),
    paymentMethodModel(connectDB).enabledMethods(),
  ]);
  return {
    items,
    paymentMethods: enabled.filter(
      (code) => code === "CASH" || paymongoConfigured(),
    ),
  };
}
export async function bookWalkInService(staff, raw) {
  if (!staffAllowed(staff)) deny("POS access is required.");
  const data = validateWalkInService(raw);
  if (!(await paymentMethodModel(connectDB).isEnabled(data.paymentCode))) {
    deny("The selected payment method is disabled.", 409);
  }
  if (data.paymentCode !== "CASH" && !paymongoConfigured()) {
    deny("PayMongo has not been configured for this store.", 503);
  }
  if (data.technicianIds.length && !["OWNER", "MANAGER"].includes(staff.role)) {
    deny("Only Owner or Manager can assign technicians.");
  }
  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const model = walkInServiceModel(db);
    const prior = await model.byRequestKey(data.requestKey);
    if (prior) {
      await db.commit();
      return {
        booking: { ...prior, assignment: "ALREADY_BOOKED" },
        alreadySaved: true,
      };
    }
    const service = await model.lockServiceType(data.serviceTypeId);
    if (!service)
      deny("This service is not active. Refresh and choose another.", 409);
    // A relocation has two distinct physical locations. Service type comes
    // from the locked database row, not an untrusted code from the browser.
    if (service.code === "relocation") {
      if (data.destinationAddress.length < 5) {
        deny(
          "Enter the relocation destination address (at least 5 characters).",
          400,
        );
      }
      if (
        data.serviceAddress.replace(/\s+/g, " ").toLowerCase() ===
        data.destinationAddress.replace(/\s+/g, " ").toLowerCase()
      ) {
        deny(
          "Pickup and destination addresses must be different for relocation.",
          400,
        );
      }
    }
    if (service.code !== "relocation" && data.destinationAddress) {
      deny(
        "A destination address can only be added for Aircon Relocation.",
        400,
      );
    }
    const quote = quoteService({
      code: service.code,
      basePrice: service.price,
      copperFeet: data.copperFeet,
      includeDismantling: data.includeDismantling,
    });
    // Price is recalculated from the locked service type; client totals are ignored.
    const fee = cents(data.additionalFee);
    const total = peso(cents(quote.total) + fee);
    const id = await model.createWalkIn(data, total);
    await reserveAppointment(db, "SERVICE", id, data.scheduledStart);
    const paymentId = await servicePaymentModel(db).createPending(
      id,
      data.paymentCode,
      total,
    );
    await ensureConfirmedWorkOrders(
      db,
      "SERVICE",
      id,
      staff,
      data.technicianIds,
    );
    await db.commit();
    return {
      booking: {
        id,
        service: service.name,
        customer: data.customerName,
        pickupAddress: data.serviceAddress,
        destinationAddress:
          service.code === "relocation" ? data.destinationAddress : null,
        scheduledStart: data.scheduledStart,
        price: Number(total),
        basePrice: quote.total,
        additionalFee: peso(fee),
        additionalFeeReason: data.additionalFeeReason,
        paymentStatus: "PENDING",
        paymentMethod: data.paymentCode,
        paymentId,
        assignment: data.technicianIds.length
          ? "ASSIGNED"
          : "PENDING_ASSIGNMENT",
      },
    };
  } catch (err) {
    await db.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      const prior = await walkInServiceModel(connectDB).byRequestKey(
        data.requestKey,
      );
      if (prior)
        return {
          booking: { ...prior, assignment: "ALREADY_BOOKED" },
          alreadySaved: true,
        };
    }
    throw err;
  } finally {
    db.release();
  }
}
