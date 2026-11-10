import { z } from "zod";
import { id, str, status } from "../workspacePrimitives.js";
export const technicianSchemas = {
  technicians: {
    create: z.strictObject({
      userId: id,
      code: str(2, 50),
    }),
    update: z.strictObject({
      status: status("ACTIVE", "INACTIVE", "UNAVAILABLE"),
    }),
  },
};
