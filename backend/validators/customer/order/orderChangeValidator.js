import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(7)
  .max(30)
  .regex(/^[+0-9 ()-]+$/);

function futurePhilippineDateTime(value) {
  if (value === null) return true;
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute] = match.map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(utc);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    utc - 8 * 60 * 60 * 1000 > Date.now()
  );
}

const editSchema = z
  .object({
    recipientName: z.string().trim().min(2).max(150),
    contactNumber: phone,
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    deliveryAddress: z.string().trim().max(2000).nullable(),
    customerNotes: z.string().trim().max(1000),
    preferredSchedule: z
      .string()
      .nullable()
      .refine(
        futurePhilippineDateTime,
        "Choose a future schedule in Philippine time, or leave it blank.",
      ),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.fulfillment === "DELIVERY" && !data.deliveryAddress) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Select a delivery address or enter one for this order.",
      });
    }
  });

const cancelSchema = z
  .object({
    reason: z.enum([
      "CHANGED_MIND",
      "WRONG_DETAILS",
      "ORDERED_BY_MISTAKE",
      "OTHER",
    ]),
    details: z.string().trim().max(300).default(""),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.reason === "OTHER" && data.details.length < 5) {
      context.addIssue({
        code: "custom",
        path: ["details"],
        message: "Briefly explain why you want to cancel.",
      });
    }
  });

function validate(schema, value) {
  const result = schema.safeParse(value);

  if (result.success) return result.data;

  const error = new Error(
    result.error.issues[0]?.message || "Invalid order details.",
  );
  error.status = 400;
  throw error;
}

export const validateOrderEdit = (value) => validate(editSchema, value);
export const validateOrderCancellation = (value) =>
  validate(cancelSchema, value);
