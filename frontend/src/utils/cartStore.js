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

  const cartUnitCount = cart.reduce(
    (total, item) => total + Math.max(0, Number(item.qty) || 0),
    0,
  );

  if (cartUnitCount + qty > 99) {
    throw new Error(
      `Your cart can hold up to 99 total units. You currently have ${cartUnitCount}.`,
    );
  }

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

function mergeKey() {
  let key = sessionStorage.getItem(MERGE_ID_KEY);

  if (!key) {
    key = crypto.randomUUID();

    sessionStorage.setItem(MERGE_ID_KEY, key);
  }

  return key;
}

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

export async function updateCartItemQuantity(
  item,
  authenticated,
  quantity,
  stock,
) {
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    throw new Error("Quantity must be between 1 and 99.");
  }

  if (!Number.isInteger(stock) || qty > stock) {
    throw new Error(
      `Only ${Number.isInteger(stock) ? stock : 0} units are available.`,
    );
  }

  if (authenticated && !item.pendingSync) {
    const variantId = Number(item.variantId);

    if (!Number.isSafeInteger(variantId) || variantId < 1) {
      throw new Error("This cart item needs to be refreshed before editing.");
    }

    await api.patch(`/api/customer/cart/items/${variantId}`, {
      quantity: qty,
      hp: item.hp,
    });

    window.dispatchEvent(new Event("av-cart-updated"));

    return;
  }

  const current = readCart();

  const index = current.findIndex(
    (row) => row.productId === item.productId && row.hp === item.hp,
  );

  if (index === -1) {
    throw new Error("Product no longer exists in your browser cart.");
  }

  const otherUnits = current.reduce(
    (sum, row, i) => sum + (i === index ? 0 : Number(row.qty)),
    0,
  );

  if (otherUnits + qty > 99) {
    throw new Error("Your cart can hold at most 99 units in total.");
  }

  saveCart(current.map((row, i) => (i === index ? { ...row, qty } : row)));
}
