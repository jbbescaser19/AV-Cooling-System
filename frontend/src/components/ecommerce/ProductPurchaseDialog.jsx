import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";

import api from "../../../api/api.js";

import {
  PENDING_ACTIONS,
  savePendingAction,
} from "../../utils/purchaseFlow.js";

import "../../styles/ecommerce/product-purchase-dialog.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductPurchaseDialog({
  product,
  mode,
  initialVariantIndex = 0,
  onClose,
  onConfirm,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const firstAvailable = product.variants.findIndex((item) => item.stock > 0);

  const initialIndex =
    product.variants[initialVariantIndex]?.stock > 0
      ? initialVariantIndex
      : Math.max(0, firstAvailable);

  const [variantIndex, setVariantIndex] = useState(initialIndex);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);

  const variant = product.variants[variantIndex];

  const available = Number.isInteger(variant?.stock) ? variant.stock : 0;

  const canBuy =
    product.stockStatus === "ready" && available >= quantity && quantity >= 1;

  const isOrderNow = mode === "order";

  useEffect(() => {
    if (variant?.stock != null && quantity > variant.stock) {
      setQuantity(Math.max(1, variant.stock));
    }
  }, [variant?.stock, quantity]);

  function updateQuantity(value) {
    const next = Math.max(
      1,
      Math.min(99, Math.floor(Number(value) || 1), available),
    );

    setQuantity(next);
  }

  function closeDialog() {
    if (!submittingRef.current) {
      onClose();
    }
  }

  function requestLogin() {
    savePendingAction({
      type: PENDING_ACTIONS.ADD_TO_CART,
      productId: product.id,
      variant: variant.hp,
      quantity,
      mergeId: crypto.randomUUID(),
      returnTo: `${location.pathname}${location.search}${location.hash}`,
    });

    onClose();

    navigate("/login", {
      state: {
        message: "Please log in to continue adding this product to your cart.",
      },
    });
  }

  async function submit() {
    if (submittingRef.current) return;

    if (!canBuy) {
      setError(
        "This horsepower is out of stock. Please select an available option.",
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      if (!isOrderNow) {
        let authenticated = false;

        try {
          const { data } = await api.get("/api/auth/customer/session");

          authenticated = data?.authenticated === true;
        } catch (error) {
          if (![401, 403].includes(error.response?.status)) {
            throw error;
          }
        }

        if (!authenticated) {
          requestLogin();
          return;
        }
      }

      await onConfirm({ variant, quantity });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to continue. Please check your connection and try again.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div
      className="purchase-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <section
        className="purchase-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isOrderNow ? "Order product" : "Add product to cart"}
      >
        <header className="purchase-dialog-head">
          <div>
            <span>{product.brand}</span>
            <h2>{product.name}</h2>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={closeDialog}
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </header>

        <div className="purchase-dialog-body">
          <section>
            <label className="purchase-label">Select horsepower</label>

            <div className="purchase-hp-grid">
              {product.variants.map((item, index) => {
                const inStock = item.stock > 0;

                return (
                  <button
                    type="button"
                    key={item.hp}
                    className={`${index === variantIndex ? "active" : ""} ${!inStock ? "is-out-of-stock" : ""}`}
                    aria-pressed={index === variantIndex}
                    disabled={submitting}
                    onClick={() => {
                      setVariantIndex(index);
                      setQuantity(1);
                      setError("");
                    }}
                  >
                    <span>{item.hp}</span>

                    <small>
                      {product.stockStatus !== "ready"
                        ? "Checking stock"
                        : inStock
                          ? `${item.stock} available`
                          : "Out of Stock"}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label className="purchase-label" htmlFor="purchase-quantity">
              Quantity
            </label>

            <div className="quantity-picker">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => updateQuantity(quantity - 1)}
                disabled={submitting || !canBuy || quantity <= 1}
              >
                <Minus size={17} />
              </button>

              <input
                id="purchase-quantity"
                type="number"
                min="1"
                max={Math.min(99, available)}
                value={quantity}
                disabled={submitting || available < 1}
                onChange={(event) => updateQuantity(event.target.value)}
              />

              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => updateQuantity(quantity + 1)}
                disabled={
                  submitting || !canBuy || quantity >= Math.min(99, available)
                }
              >
                <Plus size={17} />
              </button>
            </div>

            <p
              className={`purchase-stock-note ${available < 1 ? "is-unavailable" : ""}`}
              role="status"
            >
              {product.stockStatus === "error"
                ? "Stock information unavailable. Please try again later."
                : product.stockStatus === "loading"
                  ? "Checking availability…"
                  : available > 0
                    ? `${available} unit${available === 1 ? "" : "s"} available`
                    : "Out of Stock — choose another horsepower."}
            </p>
          </section>

          <div className="purchase-summary">
            <div>
              <span>Selected</span>
              <strong>
                {variant.hp} × {quantity}
              </strong>
            </div>

            <div>
              <span>Estimated total</span>
              <strong>{peso(variant.price * quantity)}</strong>
            </div>
          </div>

          {error && (
            <p role="alert" className="purchase-stock-error">
              {error}
            </p>
          )}
        </div>

        <footer className="purchase-dialog-actions">
          <button
            type="button"
            className="btn btn-soft"
            onClick={closeDialog}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={submit}
            disabled={!canBuy || submitting}
          >
            <ShoppingCart size={17} />

            {submitting
              ? "Please wait..."
              : isOrderNow
                ? "Continue to Checkout"
                : "Add to Cart"}
          </button>
        </footer>
      </section>
    </div>
  );
}
