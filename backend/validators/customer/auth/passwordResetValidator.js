import { z } from "zod";
import { strongPassword } from "../../shared/passwordPolicy.js";

const email = z.string().trim().toLowerCase().email().max(255);

const code = z.string().regex(/^\d{6}$/, "Enter the six-digit code.");

function parse(schema, input) {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw Object.assign(
    new Error(result.error.issues[0]?.message || "Invalid information."),
    { status: 400 },
  );
}

export function validateResetRequest(input) {
  return parse(z.object({ email }).strict(), input);
}

export function validateResetConfirmation(input) {
  return parse(
    z
      .object({
        email,
        code,
        newPassword: strongPassword,
        confirmPassword: z.string().min(1).max(128),
      })
      .strict()
      .refine((data) => data.newPassword === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "New passwords do not match.",
      }),
    input,
  );
}
