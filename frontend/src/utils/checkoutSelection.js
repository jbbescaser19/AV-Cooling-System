// Cart selection is a browser-tab UI preference, not a saved order or price.
const SELECTION_KEY = "av_checkout_selected_items";

export function cartItemKey(item) {
  return JSON.stringify([String(item.productId), String(item.hp)]);
}

export function readCheckoutSelection() {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    if (raw === null) return null;
    const keys = JSON.parse(raw);
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string")) {
      return null;
    }
    return [...new Set(keys)].slice(0, 99);
  } catch {
    return null;
  }
}

export function saveCheckoutSelection(keys) {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string")) {
    throw new Error("Invalid cart selection.");
  }
  sessionStorage.setItem(SELECTION_KEY, JSON.stringify([...new Set(keys)]));
}

export function clearCheckoutSelection() {
  sessionStorage.removeItem(SELECTION_KEY);
}
