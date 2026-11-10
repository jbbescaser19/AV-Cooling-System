import { z } from "zod";
import { status, money } from "../workspacePrimitives.js";
export const variantSchemas = {
  variants: {
    update: z.strictObject({
      srp: money.refine((v) => v > 0),
      promoPrice: money.nullable(),
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
