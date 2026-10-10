const CART_KEY = "av_cart";

export function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));

  window.dispatchEvent(new Event("av-cart-updated"));

  return cart;
}

export function addCartItem(product, variant, quantity = 1) {
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));

  const cart = readCart();

  const existing = cart.find(
    (item) => item.productId === product.id && item.hp === variant.hp,
  );

  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      hp: variant.hp,

      /*
        UI snapshot only.

        Backend must calculate the real
        price from the database later.
      */

      price: variant.price,
      srp: variant.srp,

      qty,
    });
  }

  return saveCart(cart);
}
