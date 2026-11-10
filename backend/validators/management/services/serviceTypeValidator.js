import { z } from "zod";
import { str, status, money } from "../workspacePrimitives.js";
export const serviceTypeSchemas = {
  "service-types": {
    create: z.strictObject({
      name: str(),
      code: str(2, 40),
      description: str(0, 1000),
      price: money,
    }),
    update: z.strictObject({
      name: str(),
      code: str(2, 40),
      description: str(0, 1000),
      price: money,
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
