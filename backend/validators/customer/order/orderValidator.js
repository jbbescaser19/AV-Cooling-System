import { z } from "zod";

const key = z.string().uuid();

const positiveQuantity = z.number().int().min(1).max(99);

const checkoutLine = z
  .object({
    variantId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    quantity: positiveQuantity,
  })
  .strict();

function validSchedule(value) {
  if (value === null) return true;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) return false;

  const [, y, mo, d, h, mi] = match.map(Number);
  const local = new Date(Date.UTC(y, mo - 1, d, h, mi));

  return (
    local.getUTCFullYear() === y &&
    local.getUTCMonth() === mo - 1 &&
    local.getUTCDate() === d &&
    local.getUTCHours() === h &&
    local.getUTCMinutes() === mi &&
    local.getTime() - 8 * 3600000 > Date.now()
  );
}

const base = z.object({
  requestId: key,

  recipientName: z.string().trim().min(2).max(150),

  contactNumber: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+0-9 ()-]+$/),

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),

  paymentCode: z.literal("CASH"),

  expectedTotal: z.number().finite().min(0).max(9999999999),

  deliveryAddress: z.string().trim().max(2000).nullable(),

  customerNotes: z.string().trim().max(1000),

  preferredSchedule: z
    .string()
    .nullable()
    .refine(validSchedule, "Choose a valid future schedule (Philippine time)."),
});

const cartCheckout = base
  .extend({
    source: z.literal("CART"),
    items: z.array(checkoutLine).min(1).max(99),
  })
  .strict();

const directCheckout = base
  .extend({
    source: z.literal("DIRECT"),
    productId: z.string().regex(/^[a-z0-9-]{1,100}$/),
    hp: z.string().regex(/^\d{1,2}(?:\.\d)?HP$/),
    quantity: positiveQuantity,
  })
  .strict();

const schema = z
  .discriminatedUnion("source", [cartCheckout, directCheckout])
  .superRefine((value, context) => {
    if (value.fulfillment === "DELIVERY" && !value.deliveryAddress) {
      context.addIssue({
        code: "custom",
        message:
          "Select a saved delivery address or enter an address for this order.",
        path: ["deliveryAddress"],
      });
    }

    if (value.source === "CART") {
      const ids = value.items.map((item) => item.variantId);

      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: "You selected the same product option twice.",
          path: ["items"],
        });
      }

      const totalUnits = value.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      if (totalUnits > 99) {
        context.addIssue({
          code: "custom",
          message: "Maximum 99 units per checkout.",
          path: ["items"],
        });
      }
    }
  });

export function validateCheckout(input) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const error = new Error(
    result.error.issues[0]?.message || "Invalid checkout details.",
  );

  error.status = 400;

  throw error;
}
