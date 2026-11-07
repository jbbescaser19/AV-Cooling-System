import api from "../../api/api.js";
import { readCatalogProducts } from "./catalogStore.js";
import { cartItemKey } from "./checkoutSelection.js";

const CART_KEY = "av_cart";
const MERGE_KEY = "av_cart_merge_id";
export const MAX_CART_QUANTITY = 99;

function notify() {
  window.dispatchEvent(new Event("av-cart-updated"));
}

function quantity(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

export function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  if (
    !Array.isArray(items) ||
    items.some((item) => quantity(item.qty) !== item.qty) ||
    items.reduce((sum, item) => sum + item.qty, 0) > MAX_CART_QUANTITY
  ) {
    throw new Error("Your guest cart can contain at most 99 total units.");
  }
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    localStorage.setItem(MERGE_KEY, crypto.randomUUID());
  } catch {
    throw new Error("Could not save the cart in browser storage.");
  }
  notify();
  return items;
}

function clearGuestCart() {
  localStorage.removeItem(CART_KEY);
  localStorage.removeItem(MERGE_KEY);
  notify();
}

export async function hasCustomerSession() {
  try {
    const response = await api.get("/api/auth/customer/session");
    return response.data?.authenticated === true;
  } catch (error) {
    if ([401, 403].includes(error.response?.status)) return false;
    throw new Error("Cannot check your session. Please check your connection.");
  }
}

export async function syncGuestCart() {
  const items = readCart();
  if (!items.length) return;

  let mergeId = localStorage.getItem(MERGE_KEY);
  if (!mergeId) {
    mergeId = crypto.randomUUID();
    localStorage.setItem(MERGE_KEY, mergeId);
  }
  await api.post("/api/customer/cart/merge", {
    mergeId,
    items: items.map((item) => ({
      productId: item.productId,
      hp: item.hp,
      qty: item.qty,
    })),
  });
  // Only remove local data after the server confirms a successful merge.
  if (localStorage.getItem(MERGE_KEY) === mergeId) clearGuestCart();
}

export async function getCart() {
  const authenticated = await hasCustomerSession();
  if (!authenticated)
    return { items: readCart(), authenticated: false, syncError: "" };

  try {
    await syncGuestCart();
  } catch (error) {
    return {
      items: readCart(),
      authenticated: false,
      syncError:
        error.response?.data?.message || error.message || "Cart sync failed.",
    };
  }

  const response = await api.get("/api/customer/cart");
  return {
    items: response.data.items || [],
    authenticated: true,
    syncError: "",
  };
}

export async function addCartItem(product, variant, requested = 1) {
  const qty = Number(requested);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_CART_QUANTITY) {
    throw new Error("Choose a quantity from 1 to 99.");
  }
  const authenticated = await hasCustomerSession();
  if (authenticated) {
    // Merge any unsaved guest items first. Never use browser-supplied prices.
    await syncGuestCart();
    const response = await api.post("/api/customer/cart/items", {
      productId: product.id,
      hp: variant.hp,
      quantity: qty,
    });
    notify();
    return response.data.items;
  }

  const cart = readCart();
  const total = cart.reduce((sum, item) => sum + quantity(item.qty), 0);
  if (total + qty > MAX_CART_QUANTITY) {
    throw new Error("Your cart can contain a maximum of 99 total units.");
  }
  const existing = cart.find(
    (item) => item.productId === product.id && item.hp === variant.hp,
  );
  if (existing) {
    existing.qty = quantity(existing.qty) + qty;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      hp: variant.hp,
      price: variant.price, // Guest display only
      srp: variant.srp,
      qty,
    });
  }
  return saveCart(cart);
}

// Change one cart row's HP and quantity. If the new HP already exists,
// combine those rows rather than creating duplicates.
export async function updateCartItem(
  item,
  nextHP,
  nextQuantity,
  authenticated,
) {
  const qty = Number(nextQuantity);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_CART_QUANTITY) {
    throw new Error("Quantity must be a whole number between 1 and 99.");
  }

  if (authenticated) {
    if (
      !Number.isSafeInteger(Number(item.variantId)) ||
      Number(item.variantId) < 1
    ) {
      throw new Error("Cannot identify this saved cart item.");
    }
    const response = await api.patch(
      `/api/customer/cart/items/${encodeURIComponent(item.variantId)}`,
      { hp: nextHP, quantity: qty },
    );
    notify();
    return response.data.items;
  }

  const product = readCatalogProducts().find(
    (entry) => entry.id === item.productId,
  );
  const variant = product?.variants?.find((entry) => entry.hp === nextHP);
  if (!variant)
    throw new Error("This horsepower is not available for this product.");

  const cart = readCart();
  const oldIndex = cart.findIndex(
    (entry) => entry.productId === item.productId && entry.hp === item.hp,
  );
  if (oldIndex === -1) throw new Error("Item not found. Refresh your cart.");

  const totalWithoutOld = cart.reduce(
    (sum, entry, index) => sum + (index === oldIndex ? 0 : quantity(entry.qty)),
    0,
  );
  if (totalWithoutOld + qty > MAX_CART_QUANTITY) {
    throw new Error("Your cart can contain a maximum of 99 total units.");
  }

  const updated = cart.filter((_, index) => index !== oldIndex);
  const target = updated.find(
    (entry) => entry.productId === item.productId && entry.hp === nextHP,
  );
  if (target) {
    target.qty = quantity(target.qty) + qty;
    target.price = variant.price;
    target.srp = variant.srp;
  } else {
    updated.splice(Math.min(oldIndex, updated.length), 0, {
      ...cart[oldIndex],
      name: product.name,
      brand: product.brand,
      hp: variant.hp,
      price: variant.price,
      srp: variant.srp,
      qty,
    });
  }
  return saveCart(updated);
}

export async function removeCartItem(item, authenticated) {
  if (authenticated) {
    if (!item.variantId) throw new Error("Cannot identify the saved item.");
    await api.delete(`/api/customer/cart/items/${item.variantId}`);
    notify();
  } else {
    const remaining = readCart().filter(
      (current) =>
        !(current.productId === item.productId && current.hp === item.hp),
    );
    // Allow removing items from legacy carts that already exceed the limit.
    localStorage.setItem(CART_KEY, JSON.stringify(remaining));
    localStorage.setItem(MERGE_KEY, crypto.randomUUID());
    notify();
  }
}

export async function clearCart(authenticated) {
  if (authenticated) {
    await api.delete("/api/customer/cart");
    notify();
  } else {
    clearGuestCart();
  }
}

// Remove precisely the selected checkout lines; never clear the full cart.
// Server deletions are atomic and verify quantities to catch stale carts.
export async function removeCheckedOutItems(items, authenticated) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 99) {
    throw new Error("Choose at least one item before checkout.");
  }
  const keys = items.map(cartItemKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate checkout items.");
  }

  if (authenticated) {
    const payload = items.map((item) => {
      const variantId = Number(item.variantId);
      const qty = Number(item.qty);
      if (
        !Number.isSafeInteger(variantId) ||
        variantId < 1 ||
        !Number.isSafeInteger(qty) ||
        qty < 1 ||
        qty > 99
      ) {
        throw new Error("Invalid saved cart item. Reload your cart.");
      }
      return { variantId, quantity: qty };
    });
    const response = await api.post(
      "/api/customer/cart/items/remove-selected",
      {
        items: payload,
      },
    );
    notify();
    return response.data.items;
  }

  const current = readCart();
  for (const chosen of items) {
    const found = current.find(
      (item) => cartItemKey(item) === cartItemKey(chosen),
    );
    if (!found || Number(found.qty) !== Number(chosen.qty)) {
      throw new Error(
        "Your cart changed. Review the selected items before checkout.",
      );
    }
  }
  const selectedKeys = new Set(keys);
  return saveCart(
    current.filter((item) => !selectedKeys.has(cartItemKey(item))),
  );
}
