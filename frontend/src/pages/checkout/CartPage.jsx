import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Trash2 } from "lucide-react";
import "../../styles/ecommerce/pages.css";

export default function CartPage() {
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("av_cart") || "[]"));

  const remove = (index) => {
    const next = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(next);
    localStorage.setItem("av_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("av-cart-updated"));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const count = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Cart</div>
            <h1 className="page-title">Your cart</h1>
            <p className="section-copy">Review products before checkout. On phones, each item becomes a clean stacked card instead of a squeezed desktop row.</p>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="surface empty-state">
            <ShoppingBag size={36} />
            <h2>Your cart is empty</h2>
            <p>Browse the catalog and choose the AC capacity you need.</p>
            <Link className="btn btn-dark" to="/shop">Browse Products</Link>
          </div>
        ) : (
          <>
            <div className="cart-layout">
              <div className="cart-list">
                {cart.map((item, index) => (
                  <article className="surface cart-item" key={`${item.productId}-${item.hp}-${index}`}>
                    <div className="cart-item-main">
                      <b>{item.name}</b>
                      <span>{item.brand ? `${item.brand} · ` : ""}{item.hp} · Qty {item.qty}</span>
                    </div>
                    <div className="cart-item-side">
                      <b>₱{(item.price * item.qty).toLocaleString("en-PH")}</b>
                      <button className="btn btn-soft" type="button" onClick={() => remove(index)} aria-label={`Remove ${item.name}`}><Trash2 size={17}/></button>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="surface cart-summary">
                <h2>Order summary</h2>
                <div className="cart-summary-row"><span>Items</span><strong>{count}</strong></div>
                <div className="cart-summary-row"><span>Subtotal</span><strong>₱{total.toLocaleString("en-PH")}</strong></div>
                <div className="cart-summary-row"><span>Delivery</span><strong>Calculated at checkout</strong></div>
                <div className="cart-summary-row cart-total"><span>Total</span><strong>₱{total.toLocaleString("en-PH")}</strong></div>
                <Link className="btn btn-dark" to="/checkout">Proceed to Checkout</Link>
              </aside>
            </div>

            <div className="cart-actions">
              <Link className="btn btn-soft" to="/shop">Continue Shopping</Link>
              <Link className="btn btn-dark" to="/checkout">Checkout</Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
