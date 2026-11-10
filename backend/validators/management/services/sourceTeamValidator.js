import { z } from "zod";
import { technicianIdsSchema } from "./confirmationAssignmentValidator.js";

const paramsSchema = z
  .object({
    kind: z.enum(["ORDER", "SERVICE"]),
    id: z.coerce.number().int().positive().safe(),
  })
  .strict();
const teamSchema = z
  .object({
    technicianIds: technicianIdsSchema.refine(
      (ids) => ids.length > 0,
      "Select a team leader and at least one technician.",
    ),
    workType: z.enum(["DELIVERY", "INSTALLATION", "SERVICE"]).optional(),
  })
  .strict();

function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid team details."),
      { status: 400 },
    );
  }
  return parsed.data;
}
export const validateSourceParams = (value) => parse(paramsSchema, value);
export const validateSourceTeam = (value) => parse(teamSchema, value);
