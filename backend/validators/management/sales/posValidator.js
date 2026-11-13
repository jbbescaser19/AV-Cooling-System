import { z } from "zod";
import { personName, contactNumber } from "../../shared/personFields.js";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";
import { technicianIdsSchema } from "../services/confirmationAssignmentValidator.js";
import { parseManagementInput } from "../parseManagementInput.js";
const saleSchema = z
  .strictObject({
    requestKey: z.string().uuid(),
    customerName: personName,
    customerPhone: contactNumber,
    delivery: z.boolean().default(false),
    installationIncluded: z.boolean().default(false),
    deliveryArea: z
      .string()
      .regex(/^[A-Z_]{3,40}$/)
      .nullable()
      .default(null),
    items: z
      .array(
        z.strictObject({
          variantId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(30),
    discount: z.number().finite().min(0).max(9999999).default(0),
    additionalFee: z.number().finite().min(0).max(99999.99).default(0),
    additionalFeeReason: z.string().trim().max(255).default(""),
    cashReceived: z.number().finite().min(0).max(99999999),
    scheduledStart: z
      .string()
      .nullable()
      .default(null)
      .refine((value) => {
        if (value === null) return true;
        try {
          parseBookingStart(value);
          return true;
        } catch {
          return false;
        }
      }, "Choose a future appointment from the calendar."),
    serviceAddress: z.string().trim().max(2000).default(""),
    technicianIds: technicianIdsSchema,
  })
  .superRefine((data, context) => {
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

    if (data.delivery && data.deliveryArea === "OTHER") {
      if (data.additionalFee <= 0) {
        context.addIssue({
          code: "custom",
          path: ["additionalFee"],
          message:
            "For other locations, enter the agreed delivery fee and its reason.",
        });
      }
      if (data.serviceAddress.length < 10) {
        context.addIssue({
          code: "custom",
          path: ["serviceAddress"],
          message: "Enter the complete remote delivery address.",
        });
      }
    }
    if (data.installationIncluded && !data.delivery) {
      context.addIssue({
        code: "custom",
        path: ["installationIncluded"],
        message: "Installation includes delivery.",
      });
    }
    if (data.delivery && (!data.scheduledStart || !data.deliveryArea)) {
      context.addIssue({
        code: "custom",
        path: ["deliveryArea"],
        message: "Choose a delivery area and appointment.",
      });
    }
    if (!data.delivery && data.scheduledStart) {
      context.addIssue({
        code: "custom",
        path: ["scheduledStart"],
        message: "Choose delivery before selecting an appointment.",
      });
    }
    if (!data.scheduledStart && data.technicianIds.length) {
      context.addIssue({
        code: "custom",
        path: ["technicianIds"],
        message:
          "Technicians can only be assigned for a scheduled installation.",
      });
    }
    if (data.scheduledStart && data.serviceAddress.length < 5) {
      context.addIssue({
        code: "custom",
        path: ["serviceAddress"],
        message: "Enter the installation address for scheduled POS orders.",
      });
    }
  });
export const validatePosSale = (value) =>
  parseManagementInput(saleSchema, value);
