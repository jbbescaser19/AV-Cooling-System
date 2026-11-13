import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";

// Staff must explicitly enter the amount observed in the official merchant
// statement. The customer's typed reference can never verify a payment.
const schema = z.strictObject({
  verifiedExternally: z.literal(true),
  reference: z
    .string()
    .trim()
    .min(6)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
  verifiedAmount: z.number().finite().positive().max(9999999999),
  note: z.string().trim().min(10).max(250),
});

export const validateManualTransferConfirmation = (value) =>
  parseManagementInput(schema, value);
