const PENDING_ACTION_KEY = "av_pending_action";
const DIRECT_CHECKOUT_KEY = "av_direct_checkout";

export const PENDING_ACTIONS = {
  CHECKOUT_CART: "checkout_cart",
  ORDER_NOW: "order_now",
  REQUEST_SERVICE: "request_service",
};

function safeSessionRead(key) {
  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

/* ================================
   PENDING ACTION
================================ */

export function savePendingAction(action) {
  sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

export function getPendingAction() {
  return safeSessionRead(PENDING_ACTION_KEY);
}

export function clearPendingAction() {
  sessionStorage.removeItem(PENDING_ACTION_KEY);
}

/* ================================
   DIRECT CHECKOUT
================================ */

export function saveDirectCheckout({ productId, variant, quantity }) {
  sessionStorage.setItem(
    DIRECT_CHECKOUT_KEY,
    JSON.stringify({
      productId,
      variant,
      quantity,
    }),
  );
}

export function getDirectCheckout() {
  return safeSessionRead(DIRECT_CHECKOUT_KEY);
}

export function clearDirectCheckout() {
  sessionStorage.removeItem(DIRECT_CHECKOUT_KEY);
}

/* ================================
   AFTER LOGIN / REGISTER
================================ */

export function continuePendingAction(navigate) {
  const pending = getPendingAction();

  clearPendingAction();

  if (!pending) {
    navigate("/shop");
    return;
  }

  switch (pending.type) {
    case PENDING_ACTIONS.ORDER_NOW:
      saveDirectCheckout({
        productId: pending.productId,
        variant: pending.variant,
        quantity: pending.quantity,
      });

      navigate("/checkout");
      return;

    case PENDING_ACTIONS.CHECKOUT_CART:
      navigate("/checkout");
      return;

    case PENDING_ACTIONS.REQUEST_SERVICE:
      navigate(`/services/${pending.serviceId}`);
      return;

    /*
      Compatibility with your old
      pending-action names.
    */

    case "checkout":
      navigate("/checkout");
      return;

    case "book_service":
      navigate(pending.service ? `/services/${pending.service}` : "/services");
      return;

    default:
      navigate("/shop");
  }
}
