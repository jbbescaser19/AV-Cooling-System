import connectDB from "../../../utils/dbConn.js";

import { servicePaymentModel } from "../../../models/management/sales/servicePaymentModel.js";

import { validateCashConfirmation } from "../../../validators/management/sales/paymentValidator.js";

import { createCustomerNotification } from "../../customer/notification/notificationService.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};

export async function confirmServicePayment(staff, rawId, kind, raw) {
  if (
    !staff?.id ||
    !["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff.role)
  ) {
    fail("Management access required.", 403);
  }

  if (kind !== "cash") {
    fail("Online payments are confirmed by PayMongo, not by staff.", 403);
  }

  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid service payment.");
  }

  const input = validateCashConfirmation(raw);

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = servicePaymentModel(db);
    const payment = await model.lockForVerification(id);

    if (!payment) {
      fail("Service payment not found.", 404);
    }

    if (payment.status !== "PENDING") {
      fail("This service payment is no longer pending.", 409);
    }

    if (!["CONFIRMED", "COMPLETED"].includes(payment.requestStatus)) {
      fail("Confirm this service before recording payment.", 409);
    }

    if (Number(payment.amount) !== Number(payment.currentServicePrice)) {
      fail(
        "Service price changed. Resolve the amount before confirming payment.",
        409,
      );
    }

    if (payment.method !== "CASH" || input.cashCollected !== true) {
      fail("Only physically collected cash can use staff confirmation.", 409);
    }
    const note = input.note || "Physical cash collected and verified by staff.";

    if ((await model.recordPaid(id, staff.id, note)) !== 1) {
      fail("Payment changed. Refresh and retry.", 409);
    }

    await model.audit(staff.id, id, kind);

    if (payment.customerUserId) {
      await createCustomerNotification(
        db,
        payment.customerUserId,
        "PAYMENT_CONFIRMED",
        "Service payment verified",
        `Payment for Service #${payment.requestId} is marked PAID.`,
        `/account/services/${payment.requestId}`,
      );
    }

    await db.commit();

    return {
      message: `Service #${payment.requestId} payment recorded as PAID.`,
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

/**
 * Retrieve the payment for one Service Request.
 * Never assume older requests without records are Paid.
 */
export async function getServicePaymentDetails(staff, rawRequestId) {
  if (
    !staff?.id ||
    !["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff.role)
  ) {
    fail("Management access required.", 403);
  }

  const requestId = Number(rawRequestId);

  if (!Number.isSafeInteger(requestId) || requestId <= 0) {
    fail("Invalid service request ID.", 400);
  }

  const model = servicePaymentModel(connectDB);

  if (!(await model.serviceRequestExists(requestId))) {
    fail("Service request not found.", 404);
  }

  return model.forServiceRequest(requestId);
}
