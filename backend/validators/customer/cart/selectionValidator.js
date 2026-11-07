import { z } from "zod";

const selectedCartLineSchema = z
  .object({
    variantId: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

const selectionSchema = z
  .object({
    items: z.array(selectedCartLineSchema).min(1).max(99),
  })
  .strict();

export function parseSelectedCartItems(body) {
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) {
    const error = new Error("Select valid cart items before checkout.");
    error.status = 400;
    throw error;
  }

  const ids = parsed.data.items.map((item) => item.variantId);
  if (new Set(ids).size !== ids.length) {
    const error = new Error("A cart item was selected more than once.");
    error.status = 400;
    throw error;
  }
  return parsed.data.items;
}
