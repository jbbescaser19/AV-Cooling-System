import { z } from "zod";
import { parseManagementInput } from "../parseManagementInput.js";

const money = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with at most two decimal places.",
  );

export function validatePriceAdjustment(raw) {
  return parseManagementInput(
    z
      .strictObject({
        expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),

        discount: money.refine(
          (s) => Number(s) <= 9999999,
          "Discount is too large.",
        ),

        additionalFee: money.refine(
          (s) => Number(s) <= 99999.99,
          "Additional fee must not exceed 99999.99.",
        ),

        discountReason: z.string().trim().max(255).default(""),

        additionalFeeReason: z.string().trim().max(255),

        customerAgreed: z.literal(true),
      })
      .superRefine((data, ctx) => {
        if (
          (Number(data.discount) > 0 && data.discountReason.length < 5) ||
          (Number(data.discount) === 0 && data.discountReason)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["discountReason"],
            message:
              "Enter a discount reason (5+ characters) only when a discount is applied.",
          });
        }

        if (
          Number(data.additionalFee) > 0 &&
          data.additionalFeeReason.length < 5
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["additionalFeeReason"],
            message: "Explain the additional fee (at least 5 characters).",
          });
        }

        if (Number(data.additionalFee) === 0 && data.additionalFeeReason) {
          ctx.addIssue({
            code: "custom",
            path: ["additionalFeeReason"],
            message: "Remove the reason when the additional fee is zero.",
          });
        }
      }),
    raw,
  );
}
