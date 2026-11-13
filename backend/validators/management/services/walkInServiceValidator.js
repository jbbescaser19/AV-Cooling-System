import { z } from "zod";
import { personName, contactNumber } from "../../shared/personFields.js";
import { parseBookingStart } from "../../scheduling/bookingScheduleValidator.js";
import { parseManagementInput } from "../parseManagementInput.js";
const schema = z.strictObject({
  requestKey: z.string().uuid(),
  customerName: personName,
  customerPhone: contactNumber,
  serviceAddress: z.string().trim().min(5).max(2000),
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
  technicianIds: z.array(z.number().int().positive()).max(6).default([]),
});
export const validateWalkInService = (raw) => parseManagementInput(schema, raw);
