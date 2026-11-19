import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";

const schema = z.strictObject({
  cashReturned: z.literal(true),
  reason: z.string().trim().min(5).max(500),
});

export const validateOrderCashRefund = (value) =>
  parseManagementInput(schema, value);
