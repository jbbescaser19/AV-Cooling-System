import { z } from "zod";

import { personName } from "../../shared/personFields.js";

const profileSchema = z.strictObject({
  name: personName,

  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long.")
    .transform((value) => value.replace(/[\s-]/g, ""))
    .refine((value) => /^(?:\+63|0)9\d{9}$/.test(value), {
      message: "Enter a valid Philippine mobile number.",
    }),
});

export function validateProfileUpdate(input) {
  const result = profileSchema.safeParse(input);

  if (!result.success) {
    const error = new Error(
      result.error.issues[0]?.message || "Invalid profile information.",
    );

    error.status = 400;

    throw error;
  }

  return result.data;
}
