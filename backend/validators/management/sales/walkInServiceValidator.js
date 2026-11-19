import { z } from "zod";
import { personName, contactNumber } from "../../shared/personFields.js";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";
import { parseManagementInput } from "../parseManagementInput.js";

const schema = z.strictObject({
  requestKey: z.string().uuid(),

  paymentCode: z.enum(["CASH", "GCASH", "BANK_TRANSFER"]).default("CASH"),

  cashReceived: z
    .number()
    .finite()
    .min(0)
    .max(99999999)
    .nullable()
    .default(null),

  payLater: z.boolean().optional(),

  customerName: personName,
  customerPhone: contactNumber,

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

  airconHorsepower: z.number().finite().min(0.5).max(10),

  copperFeet: z.number().int().min(1).max(100).default(10),

  includeDismantling: z.boolean().default(false),

  discount: z.number().finite().min(0).max(9999999).default(0),
  discountReason: z.string().trim().max(255).default(""),

  additionalFee: z.number().finite().min(0).max(99999.99).default(0),
  additionalFeeReason: z.string().trim().max(255).default(""),

  technicianIds: z.array(z.number().int().positive()).max(6).default([]),
});

export const validateWalkInService = (raw) =>
  parseManagementInput(
    schema.superRefine((data, context) => {
      const received = Number(data.cashReceived || 0);

      if (
        data.payLater === true &&
        (data.paymentCode !== "CASH" || received !== 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["payLater"],
          message: "Pay Later requires cash with no amount received.",
        });
      }

      if (
        data.payLater === false &&
        data.paymentCode === "CASH" &&
        received <= 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["cashReceived"],
          message: "Enter received cash or choose Pay Later.",
        });
      }

      if (data.paymentCode !== "CASH" && received > 0) {
        context.addIssue({
          code: "custom",
          path: ["cashReceived"],
          message: "Cash received is only for CASH payments.",
        });
      }

      if (
        (data.discount > 0 && data.discountReason.length < 5) ||
        (data.discount === 0 && data.discountReason)
      ) {
        context.addIssue({
          code: "custom",
          path: ["discountReason"],
          message:
            "Enter a discount reason (5+ characters) only when a discount is applied.",
        });
      }

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
