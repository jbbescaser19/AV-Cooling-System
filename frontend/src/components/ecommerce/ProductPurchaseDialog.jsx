import { useState } from "react";

import { Minus, Plus, ShoppingCart, X } from "lucide-react";

import "../../styles/ecommerce/product-purchase-dialog.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductPurchaseDialog({
  product,
  mode,
  initialVariantIndex = 0,
  onClose,
  onConfirm,
}) {
  const [variantIndex, setVariantIndex] = useState(
    Math.max(0, Math.min(initialVariantIndex, product.variants.length - 1)),
  );

  const [quantity, setQuantity] = useState(1);

  const variant = product.variants[variantIndex];

  const updateQuantity = (value) => {
    const next = Math.max(1, Math.min(99, Number(value) || 1));

    setQuantity(next);
  };

  const total = variant.price * quantity;

  const isOrderNow = mode === "order";

  return (
    <div
      className="purchase-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
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

          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="purchase-dialog-body">
          <section>
            <label className="purchase-label">Select horsepower</label>

            <div className="purchase-hp-grid">
              {product.variants.map((item, index) => (
                <button
                  type="button"
                  key={item.hp}
                  className={index === variantIndex ? "active" : ""}
                  onClick={() => setVariantIndex(index)}
                >
                  {item.hp}

                  <small>{peso(item.price)}</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="purchase-label">Quantity</label>

            <div className="quantity-picker">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => updateQuantity(quantity - 1)}
                disabled={quantity <= 1}
              >
                <Minus size={17} />
              </button>

              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(event) => updateQuantity(event.target.value)}
                aria-label="Quantity"
              />

              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => updateQuantity(quantity + 1)}
              >
                <Plus size={17} />
              </button>
            </div>
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

              <strong>{peso(total)}</strong>
            </div>
          </div>
        </div>

        <footer className="purchase-dialog-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={() =>
              onConfirm({
                variant,
                quantity,
              })
            }
          >
            <ShoppingCart size={17} />

            {isOrderNow ? "Continue to Checkout" : "Add to Cart"}
          </button>
        </footer>
      </section>
    </div>
  );
}
