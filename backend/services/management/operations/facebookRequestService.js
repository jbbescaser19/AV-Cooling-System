import { randomUUID } from "node:crypto";

import { resolveFacebookDelivery } from "./facebookDeliveryService.js";

import { fail, affected, localSQL, checkFbUrl } from "../workspaceHelpers.js";

import { assignConfirmedExistingWork } from "../services/confirmationWorkOrderService.js";

import { fulfillmentEventModel } from "../../../models/management/operations/fulfillmentEventModel.js";

import { servicePaymentModel } from "../../../models/customer/services/servicePaymentModel.js";

import { paymentMethodModel } from "../../../models/customer/order/paymentMethodModel.js";

import {
  reserveAppointment,
  checkPreferredAppointment,
  releaseAppointment,
} from "../../scheduling/bookingScheduleService.js";

function validHorsepower(value) {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0.5 &&
    Number(value) <= 20
  );
}

export async function createFacebookRequests(model, staff, data, connection) {
  localSQL(data.scheduledStart);

  data.conversationUrl = checkFbUrl(data.conversationUrl);

  let deliveryQuote = null;

  if (data.requestKind === "AIRCON") {
    if (!data.variantId || data.serviceTypeId) {
      fail("Choose an aircon variant, not a service type.");
    }

    const variant = await model.lockSellableVariant(data.variantId);

    if (!variant || Number(variant.available) < Number(data.quantity)) {
      fail(
        "This aircon model is out of stock or does not have enough available units. Refresh and select another model or quantity.",
        409,
      );
    }

    if (data.destinationAddress) {
      fail("A destination address is for Aircon Relocation service only.", 400);
    }

    deliveryQuote = resolveFacebookDelivery(data, data.address);

    data.address = deliveryQuote.address;
  } else {
    if (!data.serviceTypeId || data.variantId) {
      fail("Choose a service type, not an aircon variant.");
    }

    const type = (await model.getServiceType(data.serviceTypeId))[0];

    if (type?.status !== "ACTIVE") {
      fail("That service type is unavailable.", 409);
    }

    if (type.service_code === "relocation") {
      if (data.destinationAddress.trim().length < 5) {
        fail("Enter the relocation destination address.", 400);
      }

      if (
        data.destinationAddress.trim().toLowerCase() ===
        data.address.trim().toLowerCase()
      ) {
        fail("Pickup and destination must be different locations.", 400);
      }
    } else if (data.destinationAddress) {
      fail("Destination address is only used for Aircon Relocation.", 400);
    }

    if (!validHorsepower(data.airconHp)) {
      fail(
        "Enter the required aircon horsepower (HP). Brand and model are optional.",
        400,
      );
    }
  }

  const reference = `FB-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 18)
    .toUpperCase()}`;

  const inserted = await model.createFb(data, staff.id, reference);

  const created = inserted.insertId;

  await checkPreferredAppointment(
    connection,
    "FB",
    created,
    data.scheduledStart,
  );

  if (data.requestKind === "AIRCON") {
    await model.createFbItem(created, data.variantId, data.quantity);

    await model.saveFbDeliveryQuote(created, deliveryQuote);
  }

  await model.notifyStaff(
    "New Facebook agreement",
    `${reference} was entered by staff.`,
  );

  return created;
}

export async function updateFacebookRequests(
  model,
  staff,
  id,
  data,
  connection,
) {
  let result;
  let converted = null;

  if (!["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only Owner or Manager can confirm Facebook agreements.", 403);
  }

  const fb = (await model.lockFb(id))[0];

  if (!fb) {
    fail("Facebook agreement not found.", 404);
  }

  if (data.action === "CANCEL" && data.technicianIds?.length) {
    fail("Technicians cannot be assigned to a cancelled agreement.", 400);
  }

  if (data.action === "CANCEL") {
    if (!["PENDING", "CONFIRMED"].includes(fb.status)) {
      fail("This agreement can no longer be cancelled here.", 409);
    }

    if (data.note.length < 5) {
      fail("Enter a cancellation reason.");
    }

    result = await model.updateFb(id, "CANCELLED", data.note);

    await releaseAppointment(connection, "FB", id);

    return {
      result,
      converted,
    };
  }

  if (data.action === "CONFIRM") {
    if (fb.status !== "PENDING") {
      fail("Only pending agreements can be confirmed.", 409);
    }
  } else if (fb.status !== "CONFIRMED") {
    fail("Confirm the Messenger agreement before conversion.", 409);
  }

  // Validate delivery details before converting the agreement.
  let deliveryQuote = null;

  if (fb.request_kind === "AIRCON") {
    deliveryQuote = resolveFacebookDelivery(
      data,
      data.deliveryAddress ?? fb.delivery_address,
      fb,
    );

    await model.saveFbDeliveryQuote(id, deliveryQuote);

    fb.delivery_address = deliveryQuote.address;
  }

  if (data.action === "CONFIRM") {
    affected(await model.updateFb(id, "CONFIRMED", data.note));
  }

  await releaseAppointment(connection, "FB", id);

  const fbTime = localSQL(
    fb.preferred_schedule.length === 16
      ? fb.preferred_schedule
      : fb.preferred_schedule.slice(0, 16).replace(" ", "T"),
  );

  let orderId = null;
  let workId = null;
  let serviceRequestId = null;

  if (fb.request_kind === "AIRCON") {
    const variant = (await model.activeVariant(fb.variantId))[0];

    if (!variant) {
      fail("The selected product is no longer active.", 409);
    }

    const method = (await model.cashMethod())[0];

    if (!method) {
      fail("Enable the CASH method before converting this agreement.", 409);
    }

    const stockResult = await model.reserveStock(fb.variantId, fb.quantity);

    if (stockResult.affectedRows !== 1) {
      fail(
        "Not enough available stock to reserve. Review the agreement quantity.",
        409,
      );
    }

    const price = Number(
      variant.promo_price && Number(variant.promo_price) > 0
        ? variant.promo_price
        : variant.srp,
    );

    const subtotalCents = Math.round(price * 100) * Number(fb.quantity);

    const deliveryFeeCents = Math.round(deliveryQuote.fee * 100);

    const subtotal = (subtotalCents / 100).toFixed(2);

    const deliveryFee = (deliveryFeeCents / 100).toFixed(2);

    const total = ((subtotalCents + deliveryFeeCents) / 100).toFixed(2);

    const order = await model.fbCreateOrder(
      fb,
      method.id,
      subtotal,
      deliveryFee,
      total,
      staff.id,
      `FBORD-${fb.facebook_request_id}`,
      fbTime,
    );

    orderId = order.insertId;

    await reserveAppointment(connection, "ORDER", orderId, fbTime);

    await model.fbOrderItem(orderId, variant, fb.quantity, price.toFixed(2));

    await model.fbPayment(orderId, method.id, total);

    await model.reserveOrder(orderId, fb.variantId, fb.quantity);

    const delivery = await model.createWork({
      orderId,
      serviceRequestId: null,
      workType: "DELIVERY",
      scheduledStart: fbTime,
      customer: fb.customer_name,
      phone: fb.contact_number,
      address: fb.delivery_address,
    });

    await model.addWorkHistory(
      delivery.insertId,
      null,
      "PENDING",
      staff.id,
      "Facebook delivery work order created",
    );

    const installation = await model.createWork({
      orderId,
      serviceRequestId: null,
      workType: "INSTALLATION",
      scheduledStart: fbTime,
      customer: fb.customer_name,
      phone: fb.contact_number,
      address: fb.delivery_address,
    });

    workId = installation.insertId;

    await model.addWorkHistory(
      workId,
      null,
      "PENDING",
      staff.id,
      "Installation included with Facebook aircon sale",
    );
  } else {
    const serviceType = (await model.lockFbServiceType(fb.service_type_id))[0];

    if (serviceType?.status !== "ACTIVE") {
      fail("Service type is no longer active.", 409);
    }

    if (!validHorsepower(fb.aircon_horsepower)) {
      fail(
        "This Facebook service agreement is missing a valid horsepower (HP).",
        409,
      );
    }

    if (!(await paymentMethodModel(connection).isEnabled("CASH"))) {
      fail("Enable CASH before confirming this agreement.", 409);
    }

    const serviceRequest = await model.fbCreateServiceRequest(
      fb,
      serviceType,
      fbTime,
    );

    const guestServiceId = serviceRequest.insertId;

    serviceRequestId = guestServiceId;

    await reserveAppointment(connection, "SERVICE", guestServiceId, fbTime);

    await servicePaymentModel(connection).createPending(
      guestServiceId,
      "CASH",
      serviceType.base_price,
    );

    await fulfillmentEventModel(connection).addEvent({
      requestKey: randomUUID(),
      kind: "SERVICE",
      recordId: guestServiceId,
      eventCode: "SERVICE_ACCEPTED",
      staffId: staff.id,
      note: "Confirmed from Facebook agreement.",
      schedule: fbTime,
    });

    const work = await model.workFromFb(fb, "SERVICE", guestServiceId);

    workId = work.insertId;

    await model.addWorkHistory(
      workId,
      null,
      "PENDING",
      staff.id,
      `Facebook booking: ${serviceType.service_name}; price PHP ${serviceType.base_price}`,
    );
  }

  if (data.technicianIds?.length) {
    await assignConfirmedExistingWork(
      connection,
      orderId ? "ORDER" : "SERVICE",
      orderId || serviceRequestId,
      staff,
      data.technicianIds,
    );
  }

  result = await model.setFbConverted(id, orderId, workId);

  const convertedReference = await model.convertedReference(
    orderId ? "ORDER" : "SERVICE",
    orderId || serviceRequestId,
  );

  if (!convertedReference) {
    fail("Could not read the saved transaction reference.", 500);
  }

  converted = {
    convertedReference,
    convertedOrderId: orderId,
    convertedServiceRequestId: serviceRequestId,
    convertedWorkOrderId: workId,
  };

  await model.notifyStaff(
    "Facebook agreement converted",
    `Agreement ${fb.request_number} has a tracked work order.`,
  );

  return {
    result,
    converted,
  };
}
