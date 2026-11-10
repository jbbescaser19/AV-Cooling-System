import { z } from "zod";
import { EVENT_LABELS } from "../../constants/management/fulfillmentEvents.js";
export const eventSchema = z
  .object({
    requestKey: z.string().uuid(),
    eventCode: z.enum(Object.keys(EVENT_LABELS)),
    note: z.string().trim().max(1000).default(""),
    schedule: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable()
      .default(null),
    paymentVerified: z.boolean().optional(),
  })
  .strict();
