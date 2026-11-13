import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, FileText, ShoppingCart, Wind, Zap } from "lucide-react";

import ProductPurchaseDialog from "./ProductPurchaseDialog";
import api from "../../../api/api.js";
import { addCartItem } from "../../utils/cartStore";
import { getProductImage } from "../../utils/productImages";

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
  const [notice, setNotice] = useState("");
  const [failedImageSrc, setFailedImageSrc] = useState("");

  const image = getProductImage(product);

  const showPhoto = Boolean(image) && failedImageSrc !== image;

  const quotationOnly = Boolean(
    product.quotationOnly || !product.variants?.length,
  );

  const inStock = quotationOnly
    ? []
    : product.variants.filter((variant) => variant.stock > 0);

  const checking = !quotationOnly && product.stockStatus !== "ready";

  const outOfStock = !quotationOnly && !checking && inStock.length === 0;

  const canBuy = !quotationOnly && !checking && inStock.length > 0;

  const preview = canBuy
    ? inStock.reduce((a, b) => (b.price < a.price ? b : a))
    : product.variants?.[0];

  const savings = preview ? Math.max(0, preview.srp - preview.price) : 0;

  const discount = preview?.srp ? Math.round((savings / preview.srp) * 100) : 0;

  function handleAddToCart({ variant, quantity }) {
    try {
      addCartItem(product, variant, quantity);

      setPurchaseMode(null);
      setNotice("Added to cart.");
    } catch (error) {
      setNotice(error.message || "This product is no longer available.");
    }
  }

  async function handleOrderNow({ variant, quantity }) {
    if (!variant?.stock || variant.stock < quantity) {
      return;
    }

    const intent = {
      productId: product.id,
      variant: variant.hp,
      quantity,
    };

    try {
      await api.get("/api/auth/customer/session");

      saveDirectCheckout(intent);
      setPurchaseMode(null);

      navigate("/checkout");
    } catch (error) {
      if (error.response?.status === 401) {
        savePendingAction({
          type: PENDING_ACTIONS.ORDER_NOW,
          ...intent,
        });

        setPurchaseMode(null);
        navigate("/login");
        return;
      }

      setNotice("Unable to verify your account. Please try again.");
    }
  }

  return (
    <>
      <article className="product-card">
        <div className="product-visual">
          {outOfStock && (
            <span className="product-out-stock-badge">Out of Stock</span>
          )}

          {!outOfStock && product.badge && (
            <span className="product-card-badge">{product.badge}</span>
          )}

          {!quotationOnly && !outOfStock && discount > 0 && (
            <span className="discount-badge">-{discount}%</span>
          )}

          {showPhoto ? (
            <img
              className={
                product.id === "floor-mounted-commercial"
                  ? "product-aircon-photo product-aircon-photo--tower"
                  : "product-aircon-photo"
              }
              src={image}
              alt={`${product.name} air conditioner`}
              loading="lazy"
              decoding="async"
              onError={() => setFailedImageSrc(image)}
            />
          ) : (
            <Wind size={68} aria-hidden="true" />
          )}

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
                Choose horsepower and quantity before purchasing.
              </div>

              <div className="price-block">
                <span className="price-from">Starting from</span>

                <strong>{peso(preview.price)}</strong>

                <span className="srp">SRP {peso(preview.srp)}</span>
              </div>

              <p
                className={`stock ${
                  outOfStock ? "product-stock-unavailable" : ""
                }`}
                role="status"
              >
                {checking
                  ? product.stockStatus === "error"
                    ? "Availability unavailable"
                    : "Checking stock…"
                  : outOfStock
                    ? "Out of Stock — all horsepower options"
                    : `${inStock.length} HP option${
                        inStock.length === 1 ? "" : "s"
                      } in stock`}
              </p>

              {notice && (
                <p className="product-added-note" role="status">
                  {notice}
                </p>
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
            ) : !canBuy ? (
              <button
                className="btn btn-dark product-unavailable-action"
                type="button"
                disabled
                aria-label={
                  outOfStock
                    ? "Unavailable — out of stock"
                    : "Checking product availability"
                }
              >
                <span>
                  {outOfStock ? "Unavailable" : "Checking availability"}
                </span>
              </button>
            ) : (
              <>
                <button
                  className="btn btn-soft"
                  type="button"
                  onClick={() => {
                    setNotice("");
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

      {purchaseMode && canBuy && (
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
