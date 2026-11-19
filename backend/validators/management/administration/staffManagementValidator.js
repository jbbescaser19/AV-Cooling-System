import { z } from "zod";
import { strongPassword } from "../../shared/passwordPolicy.js";
import { personName } from "../../shared/personFields.js";
import { status } from "../workspacePrimitives.js";

export const staffManagementSchemas = {
  staff: {
    create: z.strictObject({
      name: personName,
      email: z.email().max(255),
      role: status("MANAGER", "SALES_CASHIER", "TECHNICIAN"),
      password: strongPassword,
      mustChangePassword: z.boolean().default(true),
    }),

    update: z.strictObject({
      role: status("MANAGER", "SALES_CASHIER", "TECHNICIAN"),
      status: status("ACTIVE", "INACTIVE", "SUSPENDED"),
    }),
  },
};
