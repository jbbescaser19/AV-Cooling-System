import connectDB from "../../../utils/dbConn.js";
import { walkInServiceModel } from "../../../models/management/sales/walkInServiceModel.js";
import { validateWalkInService } from "../../../validators/management/sales/walkInServiceValidator.js";
import { reserveAppointment } from "../../scheduling/bookingScheduleService.js";
import { ensureConfirmedWorkOrders } from "../services/confirmationWorkOrderService.js";

function deny(message, status = 403) {
  throw Object.assign(new Error(message), { status });
}
const staffAllowed = (staff) =>
  ["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff?.role);
export async function listWalkInServices(staff) {
  if (!staffAllowed(staff)) deny("POS access is required.");
  return { items: await walkInServiceModel(connectDB).activeServices() };
}
export async function bookWalkInService(staff, raw) {
  if (!staffAllowed(staff)) deny("POS access is required.");
  const data = validateWalkInService(raw);
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
          paymentStatus: "NOT_RECORDED",
          assignment: "ALREADY_BOOKED",
        },
        alreadySaved: true,
      };
    }
    const service = await model.lockServiceType(data.serviceTypeId);
    if (!service)
      deny("This service is not active. Refresh and choose another.", 409);
    const id = await model.createWalkIn(data, service.price);
    await reserveAppointment(db, "SERVICE", id, data.scheduledStart);
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
        scheduledStart: data.scheduledStart,
        price: Number(service.price),
        paymentStatus: "NOT_RECORDED",
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
          booking: {
            ...prior,
            paymentStatus: "NOT_RECORDED",
            assignment: "ALREADY_BOOKED",
          },
          alreadySaved: true,
        };
    }
    throw err;
  } finally {
    db.release();
  }
}
