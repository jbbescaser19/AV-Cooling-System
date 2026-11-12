import { z } from "zod";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";
import { parseManagementInput } from "../parseManagementInput.js";

const schema = z.strictObject({
  requestKey: z.string().uuid(),

  customerName: z.string().trim().min(2).max(150),

  customerPhone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .refine(
      (phone) =>
        (phone.match(/\d/g) || []).length >= 7 && /^[+0-9()\s-]+$/.test(phone),
      "Enter a valid contact number with at least 7 digits.",
    ),

  serviceAddress: z.string().trim().min(5).max(2000),
  destinationAddress: z.string().trim().max(2000).default(""),

  serviceTypeId: z.coerce.number().int().positive(),

  scheduledStart: z.string().refine((value) => {
    try {
      parseBookingStart(value);
      return true;
    } catch {
      return false;
    }
  }, "Choose an available future schedule."),

  concern: z.string().trim().max(1000).default(""),

  airconBrand: z.string().trim().max(100).default(""),

  airconModel: z.string().trim().max(150).default(""),

  airconHorsepower: z
    .union([z.number().min(0.5).max(10), z.null()])
    .default(null),

  copperFeet: z.number().int().min(1).max(100).default(10),
  includeDismantling: z.boolean().default(false),
  additionalFee: z.number().finite().min(0).max(99999.99).default(0),
  additionalFeeReason: z.string().trim().max(255).default(""),

  technicianIds: z.array(z.number().int().positive()).max(6).default([]),
});

export const validateWalkInService = (raw) =>
  parseManagementInput(
    schema.superRefine((data, context) => {
      if (data.additionalFee > 0 && data.additionalFeeReason.length < 5) {
        context.addIssue({
          code: "custom",
          path: ["additionalFeeReason"],
          message: "Explain the additional fee (at least 5 characters).",
        });
      }
      if (data.additionalFee === 0 && data.additionalFeeReason.length) {
        context.addIssue({
          code: "custom",
          path: ["additionalFeeReason"],
          message: "Remove the fee reason or enter an additional fee.",
        });
      }
    }),
    raw,
  );
