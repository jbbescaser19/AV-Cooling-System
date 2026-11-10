import { z } from "zod";

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),

    newPassword: z
      .string()
      .min(8, "Your new password must have at least 8 characters.")
      .max(128, "Your new password must have no more than 128 characters."),

    confirmPassword: z.string().min(1, "Confirm your new password.").max(128),

    signOutAllDevices: z.boolean().default(false),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The new passwords do not match.",
      });
    }

    if (data.currentPassword === data.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Choose a password different from your current password.",
      });
    }
  });

export function validatePasswordChange(input) {
  const result = passwordChangeSchema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const error = new Error(
    result.error.issues[0]?.message || "Invalid password details.",
  );

  error.status = 400;

  throw error;
}
