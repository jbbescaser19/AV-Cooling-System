/** Shared input helpers for personal contact fields (not product names/addresses). */
export const sanitizePersonName = (input) =>
  String(input ?? "").replace(/[^\p{L}\p{M} .'-]/gu, "");
export const sanitizeContactNumber = (input) =>
  String(input ?? "").replace(/[^+0-9 ()-]/g, "");
export const isValidPersonName = (value) =>
  /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(String(value || "").trim());
