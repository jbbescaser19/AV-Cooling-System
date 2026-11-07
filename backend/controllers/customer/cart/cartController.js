import {
  readCustomerCart,
  addCustomerCartItem,
  updateCustomerCartItem,
  mergeGuestCart,
  removeCustomerCartItem,
  removeSelectedCustomerCartItems,
  clearCustomerCart,
} from "../../../services/customer/cart/cartService.js";

const endpoint = (handler) => async (req, res) => {
  try {
    const cart = await handler(req);
    return res.status(200).json({ success: true, ...cart });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error("Cart request failed:", error);
    return res.status(status).json({
      success: false,
      message: status < 500 ? error.message : "Unable to update your cart.",
    });
  }
};

export const getCartController = endpoint((req) =>
  readCustomerCart(req.auth.userId),
);
export const addCartController = endpoint((req) =>
  addCustomerCartItem(req.auth.userId, req.body),
);
export const updateCartController = endpoint((req) =>
  updateCustomerCartItem(req.auth.userId, req.params.variantId, req.body),
);
export const mergeCartController = endpoint((req) =>
  mergeGuestCart(req.auth.userId, req.body),
);
export const removeCartController = endpoint((req) =>
  removeCustomerCartItem(req.auth.userId, req.params.variantId),
);
export const removeSelectedCartController = endpoint((req) =>
  removeSelectedCustomerCartItems(req.auth.userId, req.body),
);
export const clearCartController = endpoint((req) =>
  clearCustomerCart(req.auth.userId),
);
