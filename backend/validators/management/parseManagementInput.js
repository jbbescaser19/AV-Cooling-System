export function parseManagementInput(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const error = new Error(
    result.error.issues[0]?.message || "Invalid request.",
  );
  error.status = 400;
  throw error;
}
