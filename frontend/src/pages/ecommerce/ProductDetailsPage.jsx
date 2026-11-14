import { useMemo, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Check,
  FileText,
  ShieldCheck,
  ShoppingCart,
  Wind,
  Zap,
} from "lucide-react";

import ProductPurchaseDialog from "../../components/ecommerce/ProductPurchaseDialog";

import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import api from "../../../api/api.js";
import { showActionNotice } from "../../utils/confirmAction.jsx";

import { addCartItem } from "../../utils/cartStore";

import { getProductImage } from "../../utils/productImages";

import {
  PENDING_ACTIONS,
  saveDirectCheckout,
  savePendingAction,
} from "../../utils/purchaseFlow";

import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/product-details.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductDetailsPage() {
  const { productId } = useParams();

  const navigate = useNavigate();

  const { products, status, refresh } = useStorefrontCatalog();
  const product = useMemo(
    () => products.find((item) => item.id === productId),
    [products, productId],
  );

  const [variantIndex, setVariantIndex] = useState(0);

  const [purchaseMode, setPurchaseMode] = useState(null);

  const [added, setAdded] = useState(false);

  const [failedImageSrc, setFailedImageSrc] = useState("");

  const productImage = getProductImage(product);

  const showPhoto = Boolean(productImage) && failedImageSrc !== productImage;

  if (!product) {
    return (
      <section className="page-shell">
        <div className="container">
          <h1>Product not found</h1>

          <Link className="btn btn-dark" to="/shop">
            Back to Shop
          </Link>
        </div>
      </section>
    );
  }

  const quotationOnly = Boolean(
    product.quotationOnly || !product.variants?.length,
  );

  const variant = quotationOnly ? null : product.variants[variantIndex];

  const savings = variant ? Math.max(0, variant.srp - variant.price) : 0;
  const inStock =
    !quotationOnly && product.variants.some((item) => item.stock > 0);
  const selectedInStock =
    !quotationOnly && status === "ready" && variant?.stock > 0;
  const allOutOfStock = !quotationOnly && status === "ready" && !inStock;

  const handleAddToCart = ({ variant: selectedVariant, quantity }) => {
    try {
      addCartItem(product, selectedVariant, quantity);
      setPurchaseMode(null);
      setAdded(true);
    } catch (error) {
      void showActionNotice({
        title: "Cannot add to cart",
        message: error.message || "This horsepower is unavailable.",
      });
    }
  };

  const handleOrderNow = async ({ variant: selectedVariant, quantity }) => {
    if (!selectedVariant?.stock || selectedVariant.stock < quantity) return;
    const intent = {
      productId: product.id,
      variant: selectedVariant.hp,
      quantity,
    };
    try {
      await api.get("/api/auth/customer/session");
      saveDirectCheckout(intent);
      setPurchaseMode(null);
      navigate("/checkout");
    } catch (error) {
      if (error.response?.status === 401) {
        savePendingAction({ type: PENDING_ACTIONS.ORDER_NOW, ...intent });
        setPurchaseMode(null);
        navigate("/login");
      } else {
        await showActionNotice({
          title: "Account verification unavailable",
          message: "Unable to verify your account. Please try again.",
        });
      }
    }
  };

  return (
    <>
      <section className="page-shell">
        <div className="container">
          <div className="page-intro">
            <div>
              <div className="eyebrow">Product Details</div>

              <h1 className="page-title">{product.name}</h1>

              <p className="section-copy">{product.tagline}</p>
            </div>

            <Link className="btn btn-soft" to="/shop">
              Back to Shop
            </Link>
          </div>

          <div className="product-detail-shell">
            <aside className="surface product-detail-visual">
              <div className="product-detail-hero">
                {allOutOfStock && (
                  <span className="detail-out-stock-badge">Out of Stock</span>
                )}
                {showPhoto ? (
                  <img
                    className={`product-detail-photo${
                      product.id === "floor-mounted-commercial"
                        ? " product-detail-photo--tower"
                        : ""
                    }`}
                    src={productImage}
                    alt={`${product.name} air conditioner`}
                    loading="eager"
                    decoding="async"
                    onError={() => setFailedImageSrc(productImage)}
                  />
                ) : (
                  <Wind size={112} aria-hidden="true" />
                )}

                <small>{product.category}</small>
              </div>

              <div className="detail-summary">
                <div className="detail-summary-row">
                  <span>Brand</span>

                  <strong>{product.brand}</strong>
                </div>

                <div className="detail-summary-row">
                  <span>Series</span>

                  <strong>{product.name}</strong>
                </div>

                <div className="detail-summary-row">
                  <span>Availability</span>

                  <strong>
                    {quotationOnly
                      ? "By quotation"
                      : status === "error"
                        ? "Unavailable for ordering"
                        : status === "loading"
                          ? "Checking stock…"
                          : allOutOfStock
                            ? "Out of Stock"
                            : `${product.variants.filter((item) => item.stock > 0).length} HP options in stock`}
                  </strong>
                </div>
              </div>
            </aside>

            <div className="product-detail-info">
              {quotationOnly ? (
                <section className="surface detail-card">
                  <div className="detail-kicker">Commercial unit</div>

                  <h2>Pricing is subject to quotation</h2>

                  <div className="quote-banner">
                    <strong>Request a site-appropriate quote</strong>
                    Capacity, electrical work, installation distance, and
                    commercial requirements affect final pricing.
                  </div>

                  <div
                    className="detail-actions"
                    style={{
                      marginTop: 16,
                    }}
                  >
                    <Link className="btn btn-dark" to="/contact">
                      <FileText size={17} />
                      Request Quotation
                    </Link>
                  </div>
                </section>
              ) : (
                <>
                  <section className="surface detail-card">
                    <div className="detail-kicker">Capacity</div>

                    <h2>Choose horsepower</h2>

                    <div className="detail-hp-grid">
                      {product.variants.map((item, index) => (
                        <button
                          type="button"
                          className={`${index === variantIndex ? "active" : ""} ${item.stock === 0 ? "is-out-of-stock" : ""}`}
                          key={item.hp}
                          onClick={() => setVariantIndex(index)}
                        >
                          {item.hp}
                          {status === "ready" && item.stock === 0 && (
                            <small>Out of Stock</small>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="surface detail-card">
                    <div className="detail-kicker">Current selection</div>

                    <h2>{variant.hp}</h2>
                    <p
                      className={`detail-stock-status ${!selectedInStock ? "is-unavailable" : ""}`}
                      role="status"
                    >
                      {status === "error"
                        ? "Stock information unavailable — ordering disabled."
                        : status === "loading"
                          ? "Checking stock availability…"
                          : selectedInStock
                            ? `${variant.stock} unit${variant.stock === 1 ? "" : "s"} available`
                            : "Out of Stock — please choose another horsepower."}
                    </p>
                    {status === "error" && (
                      <button
                        type="button"
                        className="btn btn-soft"
                        onClick={refresh}
                      >
                        Retry stock check
                      </button>
                    )}

                    <div className="detail-price">
                      <strong>{peso(variant.price)}</strong>

                      <del>SRP {peso(variant.srp)}</del>

                      <span className="detail-save">Save {peso(savings)}</span>
                    </div>

                    {added && (
                      <p className="customer-success-note">Added to cart.</p>
                    )}
                  </section>

                  {product.warranty?.length > 0 && (
                    <section className="surface detail-card">
                      <div className="detail-kicker">Protection</div>

                      <h3>Warranty</h3>

                      <div className="detail-list">
                        {product.warranty.map((item) => (
                          <div key={item}>
                            <ShieldCheck size={16} />

                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {product.inclusions?.length > 0 && (
                    <section className="surface detail-card">
                      <div className="detail-kicker">Included</div>

                      <h3>Installation package</h3>

                      <div className="detail-list">
                        {product.inclusions.map((item) => (
                          <div key={item}>
                            <Check size={16} />

                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {product.additionalCharges?.length > 0 && (
                    <section className="surface detail-card">
                      <div className="detail-kicker">If required</div>

                      <h3>Additional charges</h3>

                      <div className="detail-list">
                        {product.additionalCharges.map((item) => (
                          <div key={item}>
                            <FileText size={16} />

                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="detail-actions">
                    <button
                      className="btn btn-soft"
                      type="button"
                      disabled={!selectedInStock}
                      onClick={() => {
                        setAdded(false);
                        setPurchaseMode("cart");
                      }}
                    >
                      <ShoppingCart size={17} />
                      {status === "ready" && !selectedInStock
                        ? "Out of Stock"
                        : "Add to Cart"}
                    </button>

                    <button
                      className="btn btn-dark"
                      type="button"
                      disabled={!selectedInStock}
                      onClick={() => setPurchaseMode("order")}
                    >
                      <Zap size={17} />
                      {status === "ready" && !selectedInStock
                        ? "Unavailable"
                        : "Order Now"}
                    </button>

                    <Link className="btn btn-soft" to="/contact">
                      Ask a Question
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {purchaseMode && selectedInStock && (
        <ProductPurchaseDialog
          product={product}
          mode={purchaseMode}
          initialVariantIndex={variantIndex}
          onClose={() => setPurchaseMode(null)}
          onConfirm={purchaseMode === "cart" ? handleAddToCart : handleOrderNow}
        />
      )}
    </>
  );
}
