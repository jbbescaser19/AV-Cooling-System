import { z } from "zod";
import { id, status, date } from "../workspacePrimitives.js";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const block = z
  .strictObject({
    status: status("AVAILABLE", "OFF"),
    reason: z.string().trim().max(200).default(""),
    startTime: z.union([z.literal(""), z.string().regex(HHMM)]).default(""),
    endTime: z.union([z.literal(""), z.string().regex(HHMM)]).default(""),
  })
  .superRefine((data, ctx) => {
    if (data.status === "OFF") {
      if (data.reason.length < 3)
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message:
            "Describe why the technician is unavailable (3+ characters).",
        });
      if (Boolean(data.startTime) !== Boolean(data.endTime))
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message:
            "Choose both start and end time, or leave both blank for a whole day.",
        });
      if (data.startTime && data.endTime && data.startTime >= data.endTime)
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "End time must be after start time.",
        });
    } else if (data.reason || data.startTime || data.endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          "AVAILABLE dates must not contain an unavailability reason or time range.",
      });
    }
  });

export const scheduleSchemas = {
  schedules: {
    create: block.safeExtend({ technicianId: id, date }),
    update: block,
  },
};
