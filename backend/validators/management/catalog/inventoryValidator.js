import { z } from "zod";
import { id, status } from "../workspacePrimitives.js";
export const inventorySchemas = {
  inventory: {
    update: z.strictObject({
      reorderLevel: z.coerce.number().int().min(0).max(1000000),
    }),
    create: z.strictObject({
      variantId: id,
      movementType: status(
        "STOCK_IN",
        "STOCK_OUT",
        "DAMAGE",
        "RETURN",
        "ADJUSTMENT",
      ),
      quantity: z.coerce
        .number()
        .int()
        .min(-100000)
        .max(100000)
        .refine((v) => v !== 0),
      note: z
        .string()
        .trim()
        .min(5, {
          message:
            "Enter a reason with at least 5 characters, e.g. New stock delivery.",
        })
        .max(500, {
          message: "Reason cannot exceed 500 characters.",
        }),
    }),
  },
};
