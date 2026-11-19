import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";

const paymentSchema = z.strictObject({
  cashCollected: z.literal(true),
  pickupReleased: z.boolean().default(false),
  note: z.string().trim().max(250).default(""),
});

export const validateCashConfirmation = (value) =>
  parseManagementInput(paymentSchema, value);
