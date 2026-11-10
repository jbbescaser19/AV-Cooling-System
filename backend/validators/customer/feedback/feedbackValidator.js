import { z } from "zod";
export const FEEDBACK_CATEGORIES = [
  "Service Quality",
  "Installation",
  "Product Quality",
  "Communication",
  "Pricing",
];
const createSchema = z
  .strictObject({
    category: z.enum(FEEDBACK_CATEGORIES),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(5).max(2000),
    subjectKind: z.enum(["GENERAL", "ORDER", "SERVICE"]),
    subjectId: z.number().int().positive().nullable(),
    allowPublicReview: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if ((data.subjectKind === "GENERAL") !== (data.subjectId === null))
      ctx.addIssue({
        code: "custom",
        path: ["subjectId"],
        message: "Choose a valid completed order or service.",
      });
    if (data.subjectKind === "GENERAL" && data.allowPublicReview)
      ctx.addIssue({
        code: "custom",
        path: ["allowPublicReview"],
        message: "General feedback must stay private.",
      });
  });
function parse(schema, value) {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  throw Object.assign(
    new Error(r.error.issues[0]?.message || "Invalid feedback."),
    { status: 400 },
  );
}
export const validateFeedback = (input) => parse(createSchema, input);
export const validateFeedbackVisibility = (input) =>
  parse(z.strictObject({ allowPublicReview: z.boolean() }), input);
