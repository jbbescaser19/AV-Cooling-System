import { z } from "zod";
import { strongPassword } from "../shared/passwordPolicy.js";

function parse(schema, input) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw Object.assign(
    new Error(result.error.issues[0]?.message || "Invalid password details."),
    { status: 400 },
  );
}

export function validateStaffChange(input) {
  return parse(
    z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: strongPassword,
        confirmPassword: z.string().min(1).max(128),
      })
      .strict()
      .refine((value) => value.newPassword === value.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      })
      .refine((value) => value.currentPassword !== value.newPassword, {
        path: ["newPassword"],
        message: "Choose a different password.",
      }),
    input,
  );
}

export function validateOwnerReset(input) {
  return parse(
    z
      .object({
        staffId: z.coerce.number().int().positive(),
        ownerPassword: z.string().min(1).max(128),
      })
      .strict(),
    input,
  );
}
