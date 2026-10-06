import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, FileText, ShieldCheck, ShoppingCart, Wind } from "lucide-react";
import { readCatalogProducts } from "../../utils/catalogStore";
import { getCustomer } from "../../utils/authMock";
import "../../styles/ecommerce/pages.css";

const peso = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function ProductDetailsPage() {
  const { productId } = useParams();
  const product = useMemo(() => readCatalogProducts().find((item) => item.id === productId), [productId]);
  const [variantIndex, setVariantIndex] = useState(0);
  const navigate = useNavigate();

  if (!product) {
    return (
      <section className="page-shell">
        <div className="container">
          <h1>Product not found</h1>
          <Link className="btn btn-dark" to="/shop">Back to Shop</Link>
        </div>
      </section>
    );
  }

  const quotationOnly = Boolean(product.quotationOnly || !product.variants?.length);
  const variant = quotationOnly ? null : product.variants[variantIndex];
  const savings = variant ? variant.srp - variant.price : 0;

  const addToCart = () => {
    if (!variant) return;
    if (!getCustomer()) {
      sessionStorage.setItem("av_pending_action", JSON.stringify({ type: "add_to_cart", productId: product.id, variant: variant.hp }));
      navigate("/login");
      return;
    }

    const cart = JSON.parse(localStorage.getItem("av_cart") || "[]");
    const existing = cart.find((item) => item.productId === product.id && item.hp === variant.hp);
    if (existing) existing.qty += 1;
    else cart.push({ productId: product.id, name: product.name, brand: product.brand, hp: variant.hp, price: variant.price, srp: variant.srp, qty: 1 });
    localStorage.setItem("av_cart", JSON.stringify(cart));
    navigate("/cart");
  };

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Product Details</div>
            <h1 className="page-title">{product.name}</h1>
            <p className="section-copy">{product.tagline}</p>
          </div>
          <Link className="btn btn-soft" to="/shop">Back to Shop</Link>
        </div>

        <div className="product-detail-shell">
          <aside className="surface product-detail-visual">
            <div className="product-detail-hero">
              <Wind size={112} />
              <small>{product.category}</small>
            </div>
            <div className="detail-summary">
              <div className="detail-summary-row"><span>Brand</span><strong>{product.brand}</strong></div>
              <div className="detail-summary-row"><span>Series</span><strong>{product.name}</strong></div>
              <div className="detail-summary-row"><span>Availability</span><strong>{quotationOnly ? "By quotation" : "Confirm before order"}</strong></div>
            </div>
          </aside>

          <div className="product-detail-info">
            {quotationOnly ? (
              <section className="surface detail-card">
                <div className="detail-kicker">Commercial unit</div>
                <h2>Pricing is subject to quotation</h2>
                <div className="quote-banner">
                  <strong>Request a site-appropriate quote</strong>
                  Capacity, electrical work, installation distance, and commercial requirements affect final pricing.
                </div>
                <div className="detail-actions" style={{marginTop:16}}>
                  <Link className="btn btn-dark" to="/contact"><FileText size={17}/>Request Quotation</Link>
                </div>
              </section>
            ) : (
              <>
                <section className="surface detail-card">
                  <div className="detail-kicker">Capacity</div>
                  <h2>Choose horsepower</h2>
                  <div className="detail-hp-grid">
                    {product.variants.map((item, index) => (
                      <button type="button" className={index === variantIndex ? "active" : ""} key={item.hp} onClick={() => setVariantIndex(index)}>{item.hp}</button>
                    ))}
                  </div>
                </section>

                <section className="surface detail-card">
                  <div className="detail-kicker">Current selection</div>
                  <h2>{variant.hp}</h2>
                  <div className="detail-price">
                    <strong>{peso(variant.price)}</strong>
                    <del>SRP {peso(variant.srp)}</del>
                    <span className="detail-save">Save {peso(savings)}</span>
                  </div>
                </section>

                {product.warranty?.length > 0 && (
                  <section className="surface detail-card">
                    <div className="detail-kicker">Protection</div>
                    <h3>Warranty</h3>
                    <div className="detail-list">
                      {product.warranty.map((item) => <div key={item}><ShieldCheck size={16}/><span>{item}</span></div>)}
                    </div>
                  </section>
                )}

                {product.inclusions?.length > 0 && (
                  <section className="surface detail-card">
                    <div className="detail-kicker">Included</div>
                    <h3>Installation package</h3>
                    <div className="detail-list">
                      {product.inclusions.map((item) => <div key={item}><Check size={16}/><span>{item}</span></div>)}
                    </div>
                  </section>
                )}

                {product.additionalCharges?.length > 0 && (
                  <section className="surface detail-card">
                    <div className="detail-kicker">If required</div>
                    <h3>Additional charges</h3>
                    <div className="detail-list">
                      {product.additionalCharges.map((item) => <div key={item}><FileText size={16}/><span>{item}</span></div>)}
                    </div>
                  </section>
                )}

                <div className="detail-actions">
                  <button className="btn btn-dark" type="button" onClick={addToCart}><ShoppingCart size={17}/>Add to Cart</button>
                  <Link className="btn btn-soft" to="/contact">Ask a Question</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
