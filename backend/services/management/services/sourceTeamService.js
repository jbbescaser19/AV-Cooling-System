import connectDB from "../../../utils/dbConn.js";
import { confirmationWorkOrderModel } from "../../../models/management/services/confirmationWorkOrderModel.js";
import {
  ensureConfirmedWorkOrders,
  reassignWorkOrderTeam,
} from "./confirmationWorkOrderService.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

/** Read the team beside the original order/service, without visiting Work Orders. */
export async function getSourceTeam(staff, kind, sourceId) {
  if (!["OWNER", "MANAGER"].includes(staff.role))
    fail("Only management can view and change teams here.", 403);
  const model = confirmationWorkOrderModel(connectDB);
  const source =
    kind === "ORDER"
      ? await model.orderSource(sourceId)
      : await model.serviceSource(sourceId);
  if (!source) fail("Order or service request not found.", 404);
  return {
    sourceStatus: source.status,
    jobs: await model.listSourceJobs(kind, sourceId),
  };
}

/** Replace the workers (first member = team leader) for every job on the source.
 * One transaction means delivery and installation share a consistent team. */
export async function saveSourceTeam(
  staff,
  kind,
  sourceId,
  technicianIds,
  workType = null,
) {
  if (!["OWNER", "MANAGER"].includes(staff.role))
    fail("Only management can assign technicians.", 403);
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = confirmationWorkOrderModel(connection);
    if (!(await model.lockSource(kind, sourceId)))
      fail("Order or service request not found.", 404);
    const createdOrFound = await ensureConfirmedWorkOrders(
      connection,
      kind,
      sourceId,
      staff,
      [],
    );
    if (!createdOrFound.length)
      fail("This order does not require field technicians.");
    const chosenJobs = workType
      ? createdOrFound.filter((job) => job.type === workType)
      : createdOrFound;
    if (!chosenJobs.length)
      fail("This order or service has no matching field job.");
    for (const job of chosenJobs) {
      const lockedWork = await model.lockWorkForTeamUpdate(job.id);
      if (!lockedWork) fail("Work order changed. Refresh and retry.");
      await reassignWorkOrderTeam(connection, lockedWork, staff, technicianIds);
    }
    const jobs = await model.listSourceJobs(kind, sourceId);
    await connection.commit();
    return { jobs };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
