import { z } from "zod";
import { id, str, status, datetime } from "../workspacePrimitives.js";
import { technicianIdsSchema } from "./confirmationAssignmentValidator.js";
export const workOrderSchemas = {
  "work-orders": {
    create: z.strictObject({
      sourceType: status("ORDER", "SERVICE_REQUEST"),
      sourceId: id,
      workType: status("DELIVERY", "INSTALLATION", "SERVICE"),
      scheduledStart: datetime,
      technicianId: id.nullable().default(null),
    }),
    update: z.strictObject({
      status: status(
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "RESCHEDULE",
        "REASSIGN",
      ),
      notes: str(0, 1000),
      technicianId: id.nullable().default(null),
      scheduledStart: datetime.nullable().default(null),
      technicianIds: technicianIdsSchema,
    }),
  },
};
