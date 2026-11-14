import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";

const serviceCashRefundSchema = z.strictObject({
  cashReturned: z.literal(true),
  receiptReference: z
    .string()
    .trim()
    .min(
      5,
      "Enter a refund receipt or voucher reference of at least 5 characters.",
    )
    .max(120, "Refund reference cannot exceed 120 characters."),
  reason: z
    .string()
    .trim()
    .min(5, "Enter a refund reason of at least 5 characters.")
    .max(500, "Refund reason cannot exceed 500 characters."),
});

export const validateServiceCashRefund = (value) =>
  parseManagementInput(serviceCashRefundSchema, value);
