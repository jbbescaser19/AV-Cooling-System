import { z } from "zod";
import { str, status, money } from "../workspacePrimitives.js";

const serviceCode = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9-]{1,39}$/,
    "Use a service code like deep-cleaning (letters, numbers, hyphens).",
  );

export const serviceTypeSchemas = {
  "service-types": {
    create: z.strictObject({
      name: str(),
      code: serviceCode,
      description: str(0, 1000),
      price: money,
    }),

    update: z.strictObject({
      name: str(),
      code: serviceCode,
      description: str(0, 1000),
      price: money,
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
