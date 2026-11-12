import { z } from "zod";

const schema = z
  .object({
    action: z.enum([
      "START_SERVICE",
      "COMPLETE_SERVICE",
      "START_DELIVERY",
      "COMPLETE_DELIVERY",
    ]),
    notes: z.string().trim().max(1000).default(""),
  })
  .strict();

export function validateTechnicianOrderProgress(rawId, raw) {
  const orderId = Number(rawId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw Object.assign(new Error("Invalid order ID."), { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid job action."),
      { status: 400 },
    );
  }
  if (
    parsed.data.action.startsWith("COMPLETE_") &&
    parsed.data.notes.length < 5
  ) {
    throw Object.assign(
      new Error("Enter a completion summary of at least 5 characters."),
      { status: 400 },
    );
  }
  return { orderId, ...parsed.data };
}
