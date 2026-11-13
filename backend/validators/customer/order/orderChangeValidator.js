import { z } from "zod";
import { personName, contactNumber } from "../../shared/personFields.js";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";

function futurePhilippineDateTime(value) {
  try {
    parseBookingStart(value);
    return true;
  } catch {
    return false;
  }
}

const editSchema = z
  .object({
    recipientName: personName,
    contactNumber,
    fulfillment: z.literal("DELIVERY"),
    deliveryAddress: z.string().trim().max(2000).nullable(),
    customerNotes: z.string().trim().max(1000),
    preferredSchedule: z
      .string()
      .refine(
        futurePhilippineDateTime,
        "Choose a future available appointment from the calendar.",
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
