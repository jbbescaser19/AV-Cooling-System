import { randomUUID } from "node:crypto";
import { quoteService } from "../../shared/serviceQuotationService.js";
import { cents, peso } from "./salesHelpers.js";
import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";
import { servicePaymentModel as managementPaymentModel } from "../../../models/management/sales/servicePaymentModel.js";
import { fulfillmentEventModel } from "../../../models/management/operations/fulfillmentEventModel.js";
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
  if (!staffAllowed(staff)) {
    deny("POS access is required.");
  }

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
  if (!staffAllowed(staff)) {
    deny("POS access is required.");
  }

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
        booking: {
          ...prior,
          assignment: "ALREADY_BOOKED",
        },
        alreadySaved: true,
      };
    }

    const service = await model.lockServiceType(data.serviceTypeId);

    if (!service) {
      deny("This service is not active. Refresh and choose another.", 409);
    }

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

    const fee = cents(data.additionalFee);
    const subtotal = cents(quote.total);
    const discount = cents(data.discount);

    if (discount >= subtotal) {
      deny("Discount must be less than the service subtotal.", 400);
    }

    const totalCents = subtotal + fee - discount;
    const total = peso(totalCents);

    const received = cents(data.cashReceived || 0);

    const cashPaid = data.paymentCode === "CASH" && received > 0;

    if (cashPaid && received < totalCents) {
      deny("Cash received must cover the full service total.", 400);
    }

    const id = await model.createWalkIn(data, total, cashPaid);

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

    if (cashPaid) {
      const payments = managementPaymentModel(db);

      const note =
        `Cash received: PHP ${peso(received)}; ` +
        `change: PHP ${peso(received - totalCents)}.`;

      if ((await payments.recordPaid(paymentId, staff.id, note)) !== 1) {
        deny("Payment changed. Refresh and retry.", 409);
      }

      await payments.audit(staff.id, paymentId, "cash");
    }

    await fulfillmentEventModel(db).addEvent({
      requestKey: randomUUID(),
      kind: "SERVICE",
      recordId: id,
      eventCode: "SERVICE_ACCEPTED",
      staffId: staff.id,
      note: "Confirmed during POS walk-in booking.",
      schedule: `${data.scheduledStart.replace("T", " ")}:00`,
    });

    const saved = await model.byRequestKey(data.requestKey);

    if (!saved?.reference) {
      deny("Saved service reference could not be read.", 500);
    }

    await db.commit();

    return {
      booking: {
        id,
        reference: saved.reference,
        service: service.name,
        customer: data.customerName,
        pickupAddress: data.serviceAddress,

        destinationAddress:
          service.code === "relocation" ? data.destinationAddress : null,

        scheduledStart: data.scheduledStart,
        price: Number(total),
        basePrice: quote.total,
        discount: peso(discount),
        discountReason: data.discountReason,
        additionalFee: peso(fee),
        additionalFeeReason: data.additionalFeeReason,
        paymentStatus: cashPaid ? "PAID" : "PENDING",
        cashReceived: cashPaid ? peso(received) : null,
        change: cashPaid ? peso(received - totalCents) : null,
        paymentMethod: data.paymentCode,
        paymentId,

        assignment: data.technicianIds.length
          ? "ASSIGNED"
          : "PENDING_ASSIGNMENT",
      },
    };
  } catch (error) {
    await db.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      const prior = await walkInServiceModel(connectDB).byRequestKey(
        data.requestKey,
      );

      if (prior) {
        return {
          booking: {
            ...prior,
            assignment: "ALREADY_BOOKED",
          },
          alreadySaved: true,
        };
      }
    }

    throw error;
  } finally {
    db.release();
  }
}
