import { Router } from "express";
import { requireCustomerAuth } from "../../middleware/requireCustomerAuth.js";
import {
  getCartController,
  addCartController,
  updateCartController,
  removeSelectedCartController,
  mergeCartController,
  removeCartController,
  clearCartController,
} from "../../controllers/customer/cart/cartController.js";

const router = Router();
router.use(requireCustomerAuth);
router.get("/", getCartController);
router.post("/items", addCartController);
router.patch("/items/:variantId", updateCartController);
router.post("/merge", mergeCartController);
router.post("/items/remove-selected", removeSelectedCartController);
router.delete("/items/:variantId", removeCartController);
router.delete("/", clearCartController);

export default router;
