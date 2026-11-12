import { quoteDeliveryFromAddress } from "../../shared/deliveryPricingService.js";
import { fail, affected, localSQL, checkFbUrl } from "../workspaceHelpers.js";
import { assignConfirmedExistingWork } from "../services/confirmationWorkOrderService.js";
import { randomUUID } from "node:crypto";
import {
  reserveAppointment,
  releaseAppointment,
  transferAppointment,
} from "../../scheduling/bookingScheduleService.js";
export async function createFacebookRequests(model, staff, data, connection) {
  let created;
  localSQL(data.scheduledStart);
  data.conversationUrl = checkFbUrl(data.conversationUrl);
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
    if (
      data.airconBrand.trim().length < 2 ||
      data.airconModel.trim().length < 2 ||
      data.airconHp == null
    ) {
      fail(
        "Service agreements must include the aircon brand, model, and horsepower.",
      );
    }
  }
  const reference = `FB-${randomUUID().replaceAll("-", "").slice(0, 18).toUpperCase()}`;
  const inserted = await model.createFb(data, staff.id, reference);
  created = inserted.insertId;
  await reserveAppointment(connection, "FB", created, data.scheduledStart);
  if (data.requestKind === "AIRCON") {
    await model.createFbItem(created, data.variantId, data.quantity);
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
  if (staff.role === "SALES_CASHIER" && data.action === "CONVERT") {
    fail("Only a manager or owner can convert a Facebook agreement.", 403);
  }
  const fb = (await model.lockFb(id))[0];
  if (!fb) {
    fail("Facebook agreement not found.", 404);
  }
  if (data.action !== "CONVERT" && data.technicianIds?.length) {
    fail("Technicians can only be selected when converting an agreement.", 400);
  }
  if (data.action === "CONFIRM") {
    if (fb.status !== "PENDING") {
      fail("Only pending agreements can be confirmed.", 409);
    }
    result = await model.updateFb(id, "CONFIRMED", data.note);
    return { result, converted };
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
    return { result, converted };
  }
  if (fb.status !== "CONFIRMED") {
    fail("Confirm the Messenger agreement before conversion.", 409);
  }
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
    affected(
      await model.reserveStock(fb.variantId, fb.quantity),
      "Not enough available stock to reserve.",
    );
    const price = Number(
      variant.promo_price && Number(variant.promo_price) > 0
        ? variant.promo_price
        : variant.srp,
    );
    const subtotal = price * fb.quantity;
    const { fee: deliveryFee } = quoteDeliveryFromAddress(fb.delivery_address);
    const total = (subtotal + deliveryFee).toFixed(2);
    const order = await model.fbCreateOrder(
      fb,
      method.id,
      subtotal.toFixed(2),
      deliveryFee.toFixed(2),
      total,
      staff.id,
      `FBORD-${fb.facebook_request_id}`,
      fbTime,
    );
    orderId = order.insertId;
    if (!(await transferAppointment(connection, "FB", id, "ORDER", orderId))) {
      await reserveAppointment(
        connection,
        "ORDER",
        orderId,
        fbTime.replace(" ", "T").slice(0, 16),
      );
    }
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
    const serviceType = (await model.getServiceType(fb.service_type_id))[0];
    if (serviceType?.status !== "ACTIVE") {
      fail("Service type is no longer active.", 409);
    }
    if (!fb.aircon_brand || !fb.aircon_model || !fb.aircon_horsepower) {
      fail(
        "This Facebook service agreement has no aircon brand, model, or horsepower. Create a complete agreement before conversion.",
        409,
      );
    }
    const serviceRequest = await model.fbCreateServiceRequest(fb, serviceType);
    const guestServiceId = serviceRequest.insertId;
    serviceRequestId = guestServiceId;
    if (
      !(await transferAppointment(
        connection,
        "FB",
        id,
        "SERVICE",
        guestServiceId,
      ))
    ) {
      await reserveAppointment(
        connection,
        "SERVICE",
        guestServiceId,
        fbTime.replace(" ", "T").slice(0, 16),
      );
    }
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
  converted = {
    convertedOrderId: orderId,
    convertedServiceRequestId: serviceRequestId,
    convertedWorkOrderId: workId,
  };
  await model.notifyStaff(
    "Facebook agreement converted",
    `Agreement ${fb.request_number} has a tracked work order.`,
  );
  return { result, converted };
}
