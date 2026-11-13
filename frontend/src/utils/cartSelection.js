/**
 * Cart-only checkout selection.
 *
 * Stores product identifiers, not prices or customer details.
 * MySQL remains the source of truth when an order is placed.
 *
 * Session storage keeps the selection through a login redirect.
 */
const SELECTION_KEY = "av_cart_checkout_selection_v1";

export function cartSelectionKey(item) {
  if (!item || !item.productId || !item.hp) return "";

  return JSON.stringify([String(item.productId), String(item.hp)]);
}

export function getSelectedCartKeys() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SELECTION_KEY) || "[]");

    return Array.isArray(parsed)
      ? parsed.filter((key) => typeof key === "string" && key.length < 250)
      : [];
  } catch {
    return [];
  }
}

export function saveSelectedCartKeys(keys) {
  const unique = [...new Set(keys)].filter(
    (key) => typeof key === "string" && key.length < 250,
  );

  try {
    sessionStorage.setItem(SELECTION_KEY, JSON.stringify(unique));
  } catch {
    // In-memory selection still works if storage is disabled.
  }

  return unique;
}

export function clearSelectedCartKeys() {
  try {
    sessionStorage.removeItem(SELECTION_KEY);
  } catch {
    // No storage available to clear.
  }
}
