import { z } from "zod";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";
import { technicianIdsSchema } from "../services/confirmationAssignmentValidator.js";
import { parseManagementInput } from "../parseManagementInput.js";
const saleSchema = z
  .strictObject({
    requestKey: z.string().uuid(),
    customerName: z.string().trim().min(2).max(150),
    customerPhone: z.string().trim().max(30).default(""),
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
