/** Sanitizers for customer and walk-in contact fields.
 * These improve form input only; backend validation is still required.
 */
export function sanitizePersonName(input) {
  return String(input ?? "").replace(/[^\p{L}\p{M} .'-]/gu, "");
}

export function sanitizeContactNumber(input) {
  return String(input ?? "").replace(/[^+0-9 ()-]/g, "");
}
