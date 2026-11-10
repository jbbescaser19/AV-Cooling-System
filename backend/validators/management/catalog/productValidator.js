import { z } from "zod";
import { id, str, status, money } from "../workspacePrimitives.js";
export const productSchemas = {
  products: {
    create: z.strictObject({
      categoryId: id,
      name: str(),
      brand: str(),
      model: str(),
      horsepower: z.coerce.number().min(0.5).max(10),
      srp: money.refine((v) => v > 0),
      promoPrice: money.nullable().default(null),
    }),
    update: z.strictObject({
      name: str(),
      brand: str(),
      model: str(),
      status: status("ACTIVE", "INACTIVE"),
    }),
  },
};
