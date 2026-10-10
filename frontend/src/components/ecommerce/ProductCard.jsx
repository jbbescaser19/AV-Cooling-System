import { useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import { Eye, FileText, ShoppingCart, Wind, Zap } from "lucide-react";

import ProductPurchaseDialog from "./ProductPurchaseDialog";

import { getCustomer } from "../../utils/authMock";

import { addCartItem } from "../../utils/cartStore";

import {
  PENDING_ACTIONS,
  saveDirectCheckout,
  savePendingAction,
} from "../../utils/purchaseFlow";

import "../../styles/ecommerce/product-card.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductCard({ product }) {
  const navigate = useNavigate();

  const [purchaseMode, setPurchaseMode] = useState(null);

  const [added, setAdded] = useState(false);

  const quotationOnly = Boolean(
    product.quotationOnly || !product.variants?.length,
  );

  const previewVariant = quotationOnly
    ? null
    : product.variants.reduce(
        (lowest, item) => (item.price < lowest.price ? item : lowest),
        product.variants[0],
      );

  const savings = previewVariant
    ? previewVariant.srp - previewVariant.price
    : 0;

  const discount = previewVariant?.srp
    ? Math.round((savings / previewVariant.srp) * 100)
    : 0;

  const handleAddToCart = ({ variant, quantity }) => {
    addCartItem(product, variant, quantity);

    setPurchaseMode(null);
    setAdded(true);
  };

  const handleOrderNow = ({ variant, quantity }) => {
    const intent = {
      productId: product.id,
      variant: variant.hp,
      quantity,
    };

    if (!getCustomer()) {
      savePendingAction({
        type: PENDING_ACTIONS.ORDER_NOW,
        ...intent,
      });

      setPurchaseMode(null);

      navigate("/login");

      return;
    }

    saveDirectCheckout(intent);

    navigate("/checkout");
  };

  return (
    <>
      <article className="product-card">
        <div className="product-visual">
          {product.badge && (
            <span className="product-card-badge">{product.badge}</span>
          )}

          {!quotationOnly && discount > 0 && (
            <span className="discount-badge">-{discount}%</span>
          )}

          <Wind size={68} />

          <small>{product.category}</small>
        </div>

        <div className="product-body">
          <div className="product-brand">{product.brand}</div>

          <h3>{product.name}</h3>

          {quotationOnly ? (
            <>
              <div className="quotation-card-price">Subject for Quotation</div>

              <p className="product-note">
                Commercial pricing depends on capacity and installation
                requirements.
              </p>
            </>
          ) : (
            <>
              <div className="product-model">
                Choose HP and quantity before adding or ordering.
              </div>

              <div className="price-block">
                <span className="price-from">Starting from</span>

                <strong>{peso(previewVariant.price)}</strong>

                <span className="srp">SRP {peso(previewVariant.srp)}</span>
              </div>

              <div className="stock">Availability confirmed before order</div>

              {added && (
                <div className="product-added-note">Added to cart.</div>
              )}
            </>
          )}

          <div
            className={`product-actions ${
              quotationOnly ? "" : "product-actions-purchase"
            }`}
          >
            <Link
              className="btn btn-soft product-view-action"
              to={`/shop/${product.id}`}
            >
              <Eye size={17} />

              <span>View Details</span>
            </Link>

            {quotationOnly ? (
              <Link className="btn btn-dark" to={`/shop/${product.id}`}>
                <FileText size={17} />

                <span>Request Quote</span>
              </Link>
            ) : (
              <>
                <button
                  className="btn btn-soft"
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    setPurchaseMode("cart");
                  }}
                >
                  <ShoppingCart size={17} />

                  <span>Add to Cart</span>
                </button>

                <button
                  className="btn btn-dark"
                  type="button"
                  onClick={() => setPurchaseMode("order")}
                >
                  <Zap size={17} />

                  <span>Order Now</span>
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      {purchaseMode && !quotationOnly && (
        <ProductPurchaseDialog
          product={product}
          mode={purchaseMode}
          onClose={() => setPurchaseMode(null)}
          onConfirm={purchaseMode === "cart" ? handleAddToCart : handleOrderNow}
        />
      )}
    </>
  );
}
