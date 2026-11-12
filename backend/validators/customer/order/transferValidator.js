import { z } from "zod";
const schema = z.strictObject({
  reference: z
    .string()
    .trim()
    .min(6)
    .max(100)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Use the transaction reference printed in your receipt.",
    )
    .transform((ref) => ref.toUpperCase()),
});
export function validateTransferReference(input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw Object.assign(
    new Error(
      result.error.issues[0]?.message || "Invalid transaction reference.",
    ),
    { status: 400 },
  );
}
