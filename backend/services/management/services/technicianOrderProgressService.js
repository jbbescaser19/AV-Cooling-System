import connectDB from "../../../utils/dbConn.js";
import { workspaceModel } from "../../../models/management/workspaceModel.js";
import { technicianOrderProgressModel } from "../../../models/management/services/technicianOrderProgressModel.js";
import { auditLogModel } from "../../../models/management/administration/auditLogModel.js";
import { fulfillOrderReservation } from "../../customer/order/stockReservationService.js";
import { updateWorkOrders } from "./workOrderService.js";
import { validateTechnicianOrderProgress } from "../../../validators/management/services/technicianOrderProgressValidator.js";

const fail = (message, status = 409) => {
  throw Object.assign(new Error(message), { status });
};

/**
 * One action for delivery + installation.
 * Separate work orders are retained for inventory, history, and auditing.
 * All database changes share one transaction.
 */
export async function changeTechnicianOrderProgress(staff, rawId, raw) {
  if (!staff?.id || !["OWNER", "MANAGER", "TECHNICIAN"].includes(staff.role)) {
    fail("Only authorized field staff can update order work.", 403);
  }

  const { orderId, action, notes } = validateTechnicianOrderProgress(
    rawId,
    raw,
  );

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const progress = technicianOrderProgressModel(connection);
    const workspace = workspaceModel(connection);

    const order = await progress.lockOrder(orderId);

    if (!order) {
      fail("Order not found.", 404);
    }

    if (!["CONFIRMED", "SCHEDULED", "IN_PROGRESS"].includes(order.status)) {
      fail("This order is not ready for technician progress.");
    }

    const jobs = await progress.lockActiveJobs(orderId);

    const delivery = jobs.find((job) => job.type === "DELIVERY");
    const installation = jobs.find((job) => job.type === "INSTALLATION");

    if (!delivery && !installation) {
      fail("No active field job exists for this order.");
    }

    const isService = Boolean(installation);

    const expectedAction = `${
      action.startsWith("START_") ? "START" : "COMPLETE"
    }_${isService ? "SERVICE" : "DELIVERY"}`;

    if (action !== expectedAction) {
      fail("This action does not match the order's work type.", 400);
    }

    const selectedJobs = [delivery, installation].filter(Boolean);

    const activeMembers = await progress.activeTeamMembers(
      selectedJobs.map((job) => job.id),
    );

    const teams = selectedJobs.map((job) =>
      activeMembers
        .filter((person) => Number(person.workId) === Number(job.id))
        .map((person) => Number(person.technicianId))
        .sort((a, b) => a - b),
    );

    if (teams.some((team) => !team.length)) {
      fail("Management must assign a technician team first.");
    }

    if (
      selectedJobs.length > 1 &&
      teams.some((team) => team.join(",") !== teams[0].join(","))
    ) {
      fail(
        "Delivery and installation have different teams. Ask Management to fix the assignment first.",
      );
    }

    if (
      staff.role === "TECHNICIAN" &&
      selectedJobs.some(
        (job) =>
          !activeMembers.some(
            (person) =>
              Number(person.workId) === Number(job.id) &&
              Number(person.userId) === Number(staff.id),
          ),
      )
    ) {
      fail("You can update only jobs assigned to your team.", 403);
    }

    const starting = action.startsWith("START_");
    const target = starting ? "IN_PROGRESS" : "COMPLETED";

    // Keep completed delivery intact.
    // Advance only the jobs that actually need the next status.
    let jobsToUpdate;

    if (delivery && installation) {
      const stages = `${delivery.status}:${installation.status}`;

      const validStages = starting
        ? {
            "ASSIGNED:ASSIGNED": [delivery, installation],
            "IN_PROGRESS:ASSIGNED": [installation],
            "COMPLETED:ASSIGNED": [installation],
          }
        : {
            "IN_PROGRESS:IN_PROGRESS": [delivery, installation],
            "COMPLETED:IN_PROGRESS": [installation],
          };

      jobsToUpdate = validStages[stages];

      if (!jobsToUpdate) {
        fail(
          `Delivery is ${delivery.status.replaceAll("_", " ").toLowerCase()} and installation is ${installation.status.replaceAll("_", " ").toLowerCase()}. This action is not available for those stages. Ask Management to review them.`,
        );
      }
    } else {
      const onlyJob = delivery || installation;
      const expected = starting ? "ASSIGNED" : "IN_PROGRESS";

      if (onlyJob.status !== expected) {
        fail(
          `The job must be ${expected.replaceAll("_", " ").toLowerCase()} before this action.`,
        );
      }

      jobsToUpdate = [onlyJob];
    }

    if (
      target === "COMPLETED" &&
      order.channel === "FACEBOOK" &&
      order.paymentStatus !== "PAID"
    ) {
      fail(
        "Confirm the collected Facebook payment before completing delivery.",
      );
    }

    // Older online orders may have completed delivery without stock-out.
    // Reconcile the existing recorded delivery once.
    // The reservation service safely skips already-converted stock.
    if (order.channel === "ONLINE" && delivery?.status === "COMPLETED") {
      await fulfillOrderReservation(connection, orderId, staff.id);
    }

    // Update only unfinished work orders.
    for (const job of jobsToUpdate) {
      const { result } = await updateWorkOrders(
        workspace,
        staff,
        job.id,
        {
          status: target,
          notes,
          technicianId: null,
          technicianIds: [],
          scheduledStart: null,
        },
        connection,
        { coordinatedOrderProgress: true },
      );

      if (result?.affectedRows !== 1) {
        fail("The work order changed. Refresh and try again.");
      }

      // Convert reserved stock when delivery is actually completed.
      if (
        target === "COMPLETED" &&
        job.type === "DELIVERY" &&
        order.channel === "ONLINE"
      ) {
        await fulfillOrderReservation(connection, orderId, staff.id);
      }
    }

    const nextStatus = target === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETED";

    await progress.recordOrderProgress(
      orderId,
      order.status,
      nextStatus,
      staff.id,
      `${action.replaceAll("_", " ")}${notes ? `: ${notes}` : ""}`,
    );

    await auditLogModel(connection).audit(
      staff.id,
      action,
      "work-orders",
      orderId,
    );

    await connection.commit();

    return {
      message: `${action.replaceAll("_", " ")} recorded.`,
      status: nextStatus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
