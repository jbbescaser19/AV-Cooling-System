import { z } from "zod";
import { str, status } from "../workspacePrimitives.js";
export const categorySchemas = {
  categories: {
    create: z.strictObject({
      name: str(2, 100),
      description: str(0, 1000),
    }),
    update: z.strictObject({
      name: str(2, 100),
      description: str(0, 1000),
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
