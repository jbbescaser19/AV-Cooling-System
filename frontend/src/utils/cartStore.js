import api from "../../api/api.js";

const CART_KEY = "av_cart";
const MERGE_ID_KEY = "av_cart_merge_key";

export function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));

  window.dispatchEvent(new Event("av-cart-updated"));

  return items;
}

/**
 * Guest cart:
 * Only add products with available stock.
 */
export function addCartItem(product, variant, quantity = 1) {
  const qty = Number(quantity);

  if (
    !Number.isInteger(qty) ||
    qty < 1 ||
    qty > 99 ||
    !Number.isInteger(variant?.stock) ||
    variant.stock < qty
  ) {
    throw new Error(
      "This horsepower is out of stock or has insufficient units.",
    );
  }

  const cart = readCart();

  const match = cart.find(
    (item) => item.productId === product.id && item.hp === variant.hp,
  );

  const next = (match?.qty || 0) + qty;

  if (next > 99 || next > variant.stock) {
    throw new Error(
      `Only ${variant.stock} units of ${variant.hp} are available.`,
    );
  }

  if (match) {
    match.qty = next;
    match.price = variant.price;
    match.srp = variant.srp;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      hp: variant.hp,
      price: variant.price,
      srp: variant.srp,
      qty,
    });
  }

  return saveCart(cart);
}

/**
 * Create a stable merge ID.
 * Retain it when merging fails so a retry
 * does not create duplicate cart items.
 */
function mergeKey() {
  let key = sessionStorage.getItem(MERGE_ID_KEY);

  if (!key) {
    key = crypto.randomUUID();

    sessionStorage.setItem(MERGE_ID_KEY, key);
  }

  return key;
}

/**
 * Merge guest cart into MySQL after login.
 *
 * If merging fails, keep the guest cart.
 * The customer can correct unavailable
 * products before trying again.
 */
export async function syncGuestCart() {
  const pending = readCart();

  if (!pending.length) {
    return;
  }

  const key = mergeKey();

  const { data } = await api.post("/api/customer/cart/merge", {
    mergeId: key,

    items: pending.map((item) => ({
      productId: item.productId,
      hp: item.hp,
      qty: Number(item.qty),
    })),
  });

  if (data?.success !== true) {
    throw new Error("Your cart could not be synced. Please try again.");
  }

  saveCart([]);

  sessionStorage.removeItem(MERGE_ID_KEY);
}

/**
 * Get the customer's cart.
 *
 * Guest: browser cart.
 * Logged in: MySQL cart.
 */
export async function getCart() {
  try {
    await api.get("/api/auth/customer/session");
  } catch (error) {
    if (error.response?.status === 401) {
      return {
        items: readCart(),
        authenticated: false,
        syncError: "",
      };
    }

    throw error;
  }

  let syncError = "";

  try {
    await syncGuestCart();
  } catch (error) {
    syncError =
      error.response?.data?.message ||
      error.message ||
      "Your browser cart could not be synced. Check quantities and retry.";
  }

  const { data } = await api.get("/api/customer/cart");

  const serverItems = data.items || [];

  return {
    items: syncError
      ? [
          ...serverItems,
          ...readCart().map((item) => ({
            ...item,
            pendingSync: true,
          })),
        ]
      : serverItems,

    authenticated: true,
    syncError,
  };
}

/**
 * Remove a cart item.
 *
 * MySQL cart items are deleted through
 * the API. Unsynced guest items are
 * removed from localStorage.
 */
export async function removeCartItem(item, authenticated) {
  if (authenticated && !item.pendingSync) {
    if (!Number.isSafeInteger(Number(item.variantId))) {
      throw new Error("This cart item cannot be removed yet. Please refresh.");
    }

    await api.delete(`/api/customer/cart/items/${item.variantId}`);

    window.dispatchEvent(new Event("av-cart-updated"));

    return;
  }

  saveCart(
    readCart().filter(
      (row) => !(row.productId === item.productId && row.hp === item.hp),
    ),
  );
}
