import api from "../../api/api.js";

const PENDING_ACTION_KEY = "av_pending_action";
const DIRECT_CHECKOUT_KEY = "av_direct_checkout";
const PENDING_ACTION_TTL = 30 * 60 * 1000;

export const PENDING_ACTIONS = {
  ADD_TO_CART: "add_to_cart",
  CHECKOUT_CART: "checkout_cart",
  ORDER_NOW: "order_now",
  REQUEST_SERVICE: "request_service",
};

function safeSessionRead(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function safeReturnPath(value, fallback = "/shop") {
  const path =
    typeof value === "string"
      ? value
      : value?.pathname
        ? `${value.pathname}${value.search || ""}${value.hash || ""}`
        : "";

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(path)
  ) {
    return fallback;
  }

  try {
    const url = new URL(path, window.location.origin);

    if (url.origin !== window.location.origin) {
      return fallback;
    }

    const allowed =
      /^\/(?:shop(?:\/[^/]+)?|services|about|contact|reviews|cart|checkout|account(?:\/[^/]+){0,2}|order-confirmation\/[^/]+)?\/?$/.test(
        url.pathname,
      );

    if (!allowed) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/* PENDING ACTION */

export function savePendingAction(action) {
  sessionStorage.setItem(
    PENDING_ACTION_KEY,
    JSON.stringify({
      ...action,
      createdAt: Date.now(),
    }),
  );
}

export function getPendingAction() {
  const pending = safeSessionRead(PENDING_ACTION_KEY);

  if (!pending || typeof pending !== "object") {
    return null;
  }

  if (
    pending.createdAt &&
    Date.now() - pending.createdAt > PENDING_ACTION_TTL
  ) {
    clearPendingAction();
    return null;
  }

  return pending;
}

export function clearPendingAction() {
  sessionStorage.removeItem(PENDING_ACTION_KEY);
}

/* DIRECT CHECKOUT */

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

/* RESUME ADD TO CART */

async function resumeAddToCart(pending, navigate) {
  const returnTo = safeReturnPath(pending.returnTo);

  let notice;

  try {
    const { data } = await api.post("/api/customer/cart/merge", {
      mergeId: pending.mergeId,
      items: [
        {
          productId: pending.productId,
          hp: pending.variant,
          qty: Number(pending.quantity),
        },
      ],
    });

    if (data?.success !== true) {
      throw new Error("Unable to confirm the cart update.");
    }

    window.dispatchEvent(new Event("av-cart-updated"));

    notice = {
      title: "Added to Cart",
      message: "Your selected product has been added to your cart.",
    };
  } catch (error) {
    notice = {
      title: "Unable to complete cart action",
      message:
        error.response?.data?.message ||
        "Please check your cart before trying to add the product again.",
    };
  }

  clearPendingAction();

  navigate(returnTo, { replace: true });

  return notice;
}

/* AFTER LOGIN */

export async function continuePendingAction(navigate, from = null) {
  const pending = getPendingAction();

  // An explicitly requested page takes priority
  // over any older pending purchase action.
  if (from) {
    const destination = safeReturnPath(from);

    clearPendingAction();

    if (!destination.startsWith("/checkout")) {
      clearDirectCheckout();
    }

    navigate(destination, { replace: true });
    return;
  }

  if (!pending) {
    navigate("/shop", { replace: true });
    return;
  }

  if (pending.type === PENDING_ACTIONS.ADD_TO_CART) {
    return resumeAddToCart(pending, navigate);
  }

  clearPendingAction();

  switch (pending.type) {
    case PENDING_ACTIONS.ORDER_NOW:
      saveDirectCheckout({
        productId: pending.productId,
        variant: pending.variant,
        quantity: pending.quantity,
      });

      navigate("/checkout", { replace: true });
      return;

    case PENDING_ACTIONS.CHECKOUT_CART:
    case "checkout":
      navigate("/checkout", { replace: true });
      return;

    case PENDING_ACTIONS.REQUEST_SERVICE:
      navigate(safeReturnPath(pending.returnTo, "/services"), {
        replace: true,
        state: {
          serviceRequestId: pending.serviceId,
        },
      });
      return;

    case "book_service":
      navigate("/services", {
        replace: true,
        state: pending.service ? { serviceRequestId: pending.service } : null,
      });
      return;

    default:
      navigate("/shop", { replace: true });
  }
}
