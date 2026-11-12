import { z } from "zod";

import { EVENT_LABELS } from "../../../constants/management/fulfillmentEvents.js";

import { technicianIdsSchema } from "../services/confirmationAssignmentValidator.js";

export const eventSchema = z
  .object({
    requestKey: z.string().uuid(),

    eventCode: z.enum(Object.keys(EVENT_LABELS)),

    // Existing customer-visible reason field.
    // Preserved for compatibility with existing requests.
    note: z.string().trim().max(1000).default(""),

    // New private note. Never sent to customer APIs.
    internalNote: z.string().trim().max(1000).default(""),

    schedule: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable()
      .default(null),

    paymentVerified: z.boolean().optional(),

    technicianIds: technicianIdsSchema,
  })
  .strict();
