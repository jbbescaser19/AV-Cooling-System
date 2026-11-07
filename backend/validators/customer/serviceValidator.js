import { z } from "zod";

const actionSchema = z.enum(["edit", "cancel", "delete"]);

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
  const [year, month, day] = date.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1000 ||
    year > 9999 ||
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== date
  ) {
    throw validationError("Choose a valid preferred date.");
  }

  const requestedAt = Date.parse(`${date}T${time}:00+08:00`);

  if (!Number.isFinite(requestedAt) || requestedAt <= Date.now()) {
    throw validationError("Choose a future date and time (Philippine time).");
  }

  return `${date} ${time}:00`;
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
