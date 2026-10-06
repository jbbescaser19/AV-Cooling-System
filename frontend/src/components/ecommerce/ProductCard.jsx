import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, FileText, ShoppingCart, Wind } from "lucide-react";
import { getCustomer } from "../../utils/authMock";
import "../../styles/ecommerce/product-card.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductCard({ product }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const navigate = useNavigate();
  const quotationOnly = Boolean(product.quotationOnly || !product.variants?.length);
  const variant = quotationOnly ? null : product.variants[variantIndex];
  const savings = variant ? variant.srp - variant.price : 0;
  const discount = variant?.srp ? Math.round((savings / variant.srp) * 100) : 0;

  const addToCart = () => {
    if (quotationOnly || !variant) return;

    if (!getCustomer()) {
      sessionStorage.setItem(
        "av_pending_action",
        JSON.stringify({
          type: "add_to_cart",
          productId: product.id,
          variant: variant.hp,
        }),
      );
      navigate("/login");
      return;
    }

    const cart = JSON.parse(localStorage.getItem("av_cart") || "[]");
    const existing = cart.find(
      (item) => item.productId === product.id && item.hp === variant.hp,
    );

    if (existing) existing.qty += 1;
    else {
      cart.push({
        productId: product.id,
        name: product.name,
        brand: product.brand,
        hp: variant.hp,
        price: variant.price,
        srp: variant.srp,
        qty: 1,
      });
    }

    localStorage.setItem("av_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("av-cart-updated"));
    alert(`${product.name} ${variant.hp} added to cart.`);
  };

  return (
    <article className="product-card">
      <div className="product-visual">
        {product.badge && <span className="product-card-badge">{product.badge}</span>}
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
              Commercial pricing depends on capacity and installation requirements.
            </p>
          </>
        ) : (
          <>
            <div className="product-model">Selected capacity: {variant.hp}</div>

            <div className="hp-row" role="group" aria-label={`${product.name} horsepower variants`}>
              {product.variants.map((item, index) => (
                <button
                  type="button"
                  key={item.hp}
                  className={index === variantIndex ? "active" : ""}
                  onClick={() => setVariantIndex(index)}
                >
                  {item.hp}
                </button>
              ))}
            </div>

            <div className="price-block">
              <span className="srp">SRP {peso(variant.srp)}</span>
              <strong>{peso(variant.price)}</strong>
              <span className="save">Save {peso(savings)}</span>
            </div>

            <div className="stock">Availability confirmed before order</div>
          </>
        )}

        <div className="product-actions">
          <Link className="btn btn-soft" to={`/shop/${product.id}`}>
            <Eye size={17} />
            <span>View Details</span>
          </Link>

          {quotationOnly ? (
            <Link className="btn btn-dark" to={`/shop/${product.id}`}>
              <FileText size={17} />
              <span>Request Quote</span>
            </Link>
          ) : (
            <button className="btn btn-dark" type="button" onClick={addToCart}>
              <ShoppingCart size={17} />
              <span>Add to Cart</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
