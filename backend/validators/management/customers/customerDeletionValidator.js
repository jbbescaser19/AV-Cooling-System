import { z } from "zod";

const customerIdSchema = z.coerce.number().int().safe().positive();

const confirmationSchema = z
  .object({
    confirmation: z.literal("DELETE"),
    password: z.string().min(1, "Enter your owner password.").max(200),
  })
  .strict();

export function validateCustomerDeletionId(rawId) {
  const parsed = customerIdSchema.safeParse(rawId);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid customer account ID."), {
      status: 400,
    });
  }
  return parsed.data;
}

export function validateCustomerDeletionConfirmation(raw) {
  const parsed = confirmationSchema.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(
      new Error("Type DELETE and enter your owner password to confirm."),
      { status: 400 },
    );
  }
  return parsed.data;
}
