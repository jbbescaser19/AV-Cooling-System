import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";

import connectDB from "../../../utils/dbConn.js";
import { customerDeletionModel } from "../../../models/management/customers/customerDeletionModel.js";
import { archiveModel } from "../../../models/management/archiveModel.js";
import { operationsModel } from "../../../models/management/operationsModel.js";
import { paymongoModel } from "../../../models/payments/paymongoModel.js";
import { confirmationWorkOrderModel } from "../../../models/management/services/confirmationWorkOrderModel.js";
import { cancelConfirmedWork } from "../services/confirmationWorkOrderService.js";
import { releaseAppointment } from "../../scheduling/bookingScheduleService.js";
import { releaseOrderReservation } from "../../customer/order/stockReservationService.js";
import {
  validateCustomerDeletionId,
  validateCustomerDeletionConfirmation,
} from "../../../validators/management/customers/customerDeletionValidator.js";

const CANCELLABLE_ORDERS = new Set(["PENDING", "CONFIRMED", "SCHEDULED"]);
const CANCELLABLE_SERVICES = new Set(["PENDING", "CONFIRMED"]);
const FINISHED = new Set(["COMPLETED", "CANCELLED"]);

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

function requireOwner(staff) {
  if (!staff?.id || staff.role !== "OWNER") {
    fail("Only the Owner can delete customer accounts.", 403);
  }
}

async function examineAccount(db, customerId, lock) {
  const model = customerDeletionModel(db);
  const events = operationsModel(db);
  const checkout = paymongoModel(db);
  const jobs = confirmationWorkOrderModel(db);
  const customer = await model.customer(customerId, lock);
  if (!customer) fail("Customer account not found or already deleted.", 404);

  const orders = await model.orderRecords(customerId, lock);
  const services = await model.serviceRecords(customerId, lock);
  const blockers = [];
  const cancellableOrders = [];
  const cancellableServices = [];
  let preservedOrders = 0;
  let preservedServices = 0;

  for (const order of orders) {
    if (FINISHED.has(order.status)) {
      preservedOrders++;
      continue;
    }
    if (!CANCELLABLE_ORDERS.has(order.status)) {
      blockers.push(
        `Order #${order.id} is ${order.status.toLowerCase()}; finish or resolve it first.`,
      );
      continue;
    }
    if (order.paymentStatus !== "PENDING") {
      blockers.push(
        `Order #${order.id} has payment status ${order.paymentStatus}; reconcile payment or refund first.`,
      );
      continue;
    }
    const payments = await model.orderPayments(order.id, lock);
    if (payments.some((payment) => payment.status !== "PENDING")) {
      blockers.push(
        `Order #${order.id} has a payment requiring manual review.`,
      );
      continue;
    }
    if (await checkout.hasUnsettledCheckout("ORDER", order.id)) {
      blockers.push(
        `Order #${order.id} has an active PayMongo checkout; expire or reconcile it first.`,
      );
      continue;
    }
    const work = await jobs.workForSource("ORDER", order.id);
    if (
      work.some((job) => !["PENDING", "ASSIGNED"].includes(job.status)) ||
      (await events.hasEvent("ORDER", order.id, "ORDER_OUT_FOR_DELIVERY")) ||
      (await events.hasEvent("ORDER", order.id, "ORDER_DELIVERED")) ||
      (await events.hasEvent("ORDER", order.id, "INSTALLATION_STARTED"))
    ) {
      blockers.push(
        `Order #${order.id} has field work or delivery that started or finished.`,
      );
      continue;
    }
    cancellableOrders.push({ id: order.id, oldStatus: order.status });
  }

  for (const service of services) {
    if (FINISHED.has(service.status)) {
      preservedServices++;
      continue;
    }
    if (!CANCELLABLE_SERVICES.has(service.status)) {
      blockers.push(
        `Service #${service.id} is ${service.status.toLowerCase()}; resolve it first.`,
      );
      continue;
    }
    const payments = await model.servicePayments(service.id, lock);
    if (
      payments.some(
        (payment) =>
          payment.status !== "PENDING" && payment.status !== "CANCELLED",
      )
    ) {
      blockers.push(
        `Service #${service.id} has a payment requiring refund or review.`,
      );
      continue;
    }
    if (await checkout.hasUnsettledCheckout("SERVICE", service.id)) {
      blockers.push(
        `Service #${service.id} has an active PayMongo checkout; expire or reconcile it first.`,
      );
      continue;
    }
    const work = await jobs.workForSource("SERVICE", service.id);
    if (
      work.some((job) => !["PENDING", "ASSIGNED"].includes(job.status)) ||
      (await events.hasEvent("SERVICE", service.id, "SERVICE_STARTED"))
    ) {
      blockers.push(
        `Service #${service.id} has technician work that started or finished.`,
      );
      continue;
    }
    cancellableServices.push({ id: service.id, oldStatus: service.status });
  }
  return {
    customer,
    orders: cancellableOrders,
    services: cancellableServices,
    blockers,
    summary: {
      ordersToCancel: cancellableOrders.length,
      servicesToCancel: cancellableServices.length,
      completedOrCancelledOrdersKept: preservedOrders,
      completedOrCancelledServicesKept: preservedServices,
    },
  };
}

export async function customerDeletionPreview(staff, rawId) {
  requireOwner(staff);
  const id = validateCustomerDeletionId(rawId);
  const result = await examineAccount(connectDB, id, false);
  return {
    customer: {
      id: result.customer.id,
      name: result.customer.name,
      email: result.customer.email,
    },
    summary: result.summary,
    blockers: result.blockers,
    canDelete: result.blockers.length === 0,
  };
}

export async function deleteCustomerAccount(staff, rawId, body) {
  requireOwner(staff);
  const id = validateCustomerDeletionId(rawId);
  const { password } = validateCustomerDeletionConfirmation(body);
  // Owner password verification prevents accidental or stolen-cookie deletion.
  const ownerHash = await customerDeletionModel(connectDB).ownerPasswordHash(
    staff.id,
  );
  if (!ownerHash || !(await bcrypt.compare(password, ownerHash))) {
    fail("Owner password is incorrect. Account was not deleted.", 403);
  }

  const db = await connectDB.getConnection();
  try {
    await db.beginTransaction();
    const result = await examineAccount(db, id, true);
    if (result.blockers.length) {
      fail(
        `Cannot delete this account yet: ${result.blockers[0]}${result.blockers.length > 1 ? ` (+${result.blockers.length - 1} more)` : ""}`,
      );
    }
    const accounts = customerDeletionModel(db);
    const operations = operationsModel(db);
    const note =
      "Cancelled by Owner as part of confirmed customer account deletion.";

    for (const order of result.orders) {
      await cancelConfirmedWork(db, "ORDER", order.id);
      await operations.cancelPendingPayments(order.id);
      await operations.cancelOrderPayment(order.id);
      await releaseOrderReservation(db, order.id);
      await operations.setOrderStatus(order.id, "CANCELLED", null);
      await releaseAppointment(db, "ORDER", order.id);
      await operations.addOrderHistory(
        order.id,
        order.oldStatus,
        "CANCELLED",
        staff.id,
        note,
      );
      await operations.addEvent({
        requestKey: randomUUID(),
        kind: "ORDER",
        recordId: order.id,
        eventCode: "ORDER_CANCELLED_BY_STAFF",
        staffId: staff.id,
        note,
        schedule: null,
      });
      await accounts.auditCancellation(staff.id, "ORDER", order.id);
    }
    for (const service of result.services) {
      await cancelConfirmedWork(db, "SERVICE", service.id);
      await accounts.cancelPendingServicePayments(service.id);
      await operations.setServiceStatus(service.id, "CANCELLED", null);
      await releaseAppointment(db, "SERVICE", service.id);
      await operations.addEvent({
        requestKey: randomUUID(),
        kind: "SERVICE",
        recordId: service.id,
        eventCode: "SERVICE_CANCELLED",
        staffId: staff.id,
        note,
        schedule: null,
      });
      await accounts.auditCancellation(staff.id, "SERVICE", service.id);
    }

    await accounts.removePersonalSettings(id);
    await accounts.closeCustomer(id);
    const tombstoneEmail = `deleted-customer-${result.customer.userId}@accounts.invalid`;
    const unusablePasswordHash = randomBytes(48).toString("hex");
    const changed = await accounts.closeLogin(
      result.customer.userId,
      tombstoneEmail,
      unusablePasswordHash,
    );
    if (changed.affectedRows !== 1)
      fail("Customer account changed. Refresh and retry.");
    await accounts.auditDelete(staff.id, id);
    // Archive metadata in the SAME transaction, so a successful deletion
    // cannot disappear from Management -> Archive.
    await archiveModel(db).add({
      archiveId: randomUUID(),
      module: "customer-accounts",
      origin: "customer-accounts",
      id,
      label: `Deleted customer #${id}`,
      snapshot: {
        accountType: "CUSTOMER",
        userId: result.customer.userId,
        cancelledOrderIds: result.orders.map((order) => order.id),
        cancelledServiceIds: result.services.map((service) => service.id),
        completedOrCancelledOrdersKept:
          result.summary.completedOrCancelledOrdersKept,
        completedOrCancelledServicesKept:
          result.summary.completedOrCancelledServicesKept,
        originalStatus: result.customer.userStatus,
      },
      previousStatus: result.customer.userStatus,
      staffId: staff.id,
    });
    await db.commit();
    return {
      message:
        "Customer account moved to Archive. Eligible pending and confirmed orders and services were cancelled; completed records remain preserved.",
      cancelledOrders: result.orders.length,
      cancelledServices: result.services.length,
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
