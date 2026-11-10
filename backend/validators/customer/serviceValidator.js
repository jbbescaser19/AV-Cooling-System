import { z } from "zod";
import { parseBookingStart } from "../scheduling/bookingScheduleValidator.js";

const actionSchema = z.enum(["edit", "cancel", "delete"]);

const purchasedAirconSchema = z.strictObject({
  source: z.literal("PURCHASED"),
  orderItemId: z.number().int().positive(),
});

const customerOwnedAirconSchema = z.strictObject({
  source: z.literal("CUSTOMER_OWNED"),
  brand: z.string().trim().min(2).max(100),
  model: z.string().trim().min(2).max(150),
  horsepower: z
    .number()
    .min(0.5)
    .max(20)
    .refine(
      (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-8,
      "Enter horsepower using one decimal place at most.",
    ),
});

const newServiceSchema = z.strictObject({
  serviceType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,39}$/),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceAddress: z.string().trim().min(5).max(2000),
  destinationAddress: z.string().trim().max(2000).nullable().optional(),
  concern: z.string().trim().max(3000).optional(),
  notes: z.string().trim().max(3000).optional(),
  aircon: z
    .discriminatedUnion("source", [
      purchasedAirconSchema,
      customerOwnedAirconSchema,
    ])
    .nullable()
    .optional(),
});

const revisionSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
});

const editSchema = revisionSchema.extend({
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),

  contactNumber: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^\+?[0-9 ()-]+$/)
    .refine((value) => value.replace(/\D/g, "").length >= 7),

  serviceAddress: z.string().trim().min(5).max(2000),

  destinationAddress: z.string().trim().max(2000).nullable().optional(),

  concern: z.string().trim().max(3000).optional(),

  notes: z.string().trim().max(3000).optional(),
});

const relocationAddressSchema = z.string().trim().min(5).max(2000);

function validationError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function parsePositiveId(value, message, status = 400) {
  const validType = typeof value === "string" || typeof value === "number";

  if (
    !validType ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw validationError(message, status);
  }

  return Number(value);
}

function parsePreferredStart(date, time) {
  return parseBookingStart(`${date}T${time}`).sql;
}

export function validateNewServiceRequest(input) {
  const parsed = newServiceSchema.safeParse(input);

  if (!parsed.success) {
    throw validationError(
      parsed.error.issues[0]?.message || "Check the service request details.",
    );
  }

  const data = parsed.data;

  if (!data.aircon) {
    throw validationError("Select the air conditioner for this service.");
  }

  return data;
}

export function validateCustomerUserId(userId) {
  return parsePositiveId(userId, "Invalid customer session.", 401);
}

export function validateServiceChange(requestId, action, input) {
  const id = parsePositiveId(requestId, "Invalid request ID.");
  const parsedAction = actionSchema.safeParse(action);

  if (!parsedAction.success) {
    throw validationError("Invalid action.");
  }

  const schema = parsedAction.data === "edit" ? editSchema : revisionSchema;

  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw validationError("Check the service details and try again.");
  }

  const data = parsed.data;

  return {
    requestId: id,
    action: parsedAction.data,
    data:
      parsedAction.data === "edit"
        ? {
            ...data,
            preferredStart: parsePreferredStart(
              data.preferredDate,
              data.preferredTime,
            ),
          }
        : data,
  };
}

// serviceType must come from the database, not the request body.
export function validateServiceDestination(serviceType, destinationAddress) {
  if (serviceType !== "relocation") {
    return null;
  }

  const parsed = relocationAddressSchema.safeParse(destinationAddress);

  if (!parsed.success) {
    throw validationError(
      "Enter the relocation destination address (5–2000 characters).",
    );
  }

  return parsed.data;
}
