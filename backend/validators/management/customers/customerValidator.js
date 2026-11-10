import { z } from "zod";
import { status } from "../workspacePrimitives.js";
export const customerSchemas = {
  customers: {
    update: z.strictObject({
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
