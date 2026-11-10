import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Trash2 } from "lucide-react";
import { getCart, removeCartItem } from "../../utils/cartStore";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/cart.css";

const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

export default function CartPage() {
  const [cart, setCart] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [reload, setReload] = useState(0);
  const {
    products,
    status: stockStatus,
    refresh: refreshStock,
  } = useStorefrontCatalog();
  const liveMap = useMemo(
    () =>
      new Map(
        products.flatMap((product) =>
          (product.variants || []).map((variant) => [
            `${product.id}:${variant.hp}`,
            variant,
          ]),
        ),
      ),
    [products],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getCart()
      .then((result) => {
        if (!active) return;
        setCart(result.items);
        setAuthenticated(result.authenticated);
        setSyncError(result.syncError || "");
      })
      .catch((err) => {
        if (active)
          setError(err.response?.data?.message || "Unable to load your cart.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const stockWarnings = cart.map((item) => {
    const variant = liveMap.get(`${item.productId}:${item.hp}`);
    const available = variant?.stock;
    return {
      ...item,
      available,
      blocked:
        stockStatus !== "ready" ||
        !Number.isInteger(available) ||
        available < Number(item.qty),
    };
  });
  const blocked =
    stockStatus !== "ready" || stockWarnings.some((item) => item.blocked);
  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );
  const count = cart.reduce((sum, item) => sum + Number(item.qty), 0);

  async function remove(item) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await removeCartItem(item, authenticated);
      setReload((n) => n + 1);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not remove item.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Cart</div>
            <h1 className="page-title">Your cart</h1>
            <p className="section-copy">
              Only available products can proceed to checkout. Stock is checked
              again when your order is placed.
            </p>
          </div>
        </div>
        {loading && (
          <p className="surface" role="status" style={{ padding: 18 }}>
            Loading cart…
          </p>
        )}
        {error && (
          <p
            className="surface"
            role="alert"
            style={{ padding: 18, color: "#9b1c1c" }}
          >
            {error}
          </p>
        )}
        {!loading && (error || syncError) && (
          <div
            className="surface"
            style={{ padding: 14, marginBottom: 12 }}
            role="alert"
          >
            {syncError && <p>Cart sync: {syncError}</p>}
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                setReload((n) => n + 1);
                refreshStock();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && cart.length === 0 && (
          <div className="surface empty-state">
            <ShoppingBag size={36} />
            <h2>Your cart is empty</h2>
            <p>Browse the catalog and choose the aircon capacity you need.</p>
            <Link className="btn btn-dark" to="/shop">
              Browse Products
            </Link>
          </div>
        )}
        {!loading && !error && cart.length > 0 && (
          <>
            {blocked && (
              <div
                className="surface"
                role="alert"
                style={{
                  padding: 14,
                  marginBottom: 14,
                  border: "1px solid #d6a2a8",
                }}
              >
                <strong>Checkout is temporarily unavailable.</strong>
                <p>
                  {stockStatus === "ready"
                    ? "An item in your cart is out of stock or exceeds available units. Remove it or select an in-stock option in the Shop."
                    : "Product availability could not be confirmed. Please retry."}
                </p>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={refreshStock}
                >
                  Check stock again
                </button>
              </div>
            )}
            <div className="cart-layout">
              <div className="cart-list">
                {stockWarnings.map((item) => (
                  <article
                    className="surface cart-item"
                    key={`${item.productId}-${item.hp}`}
                  >
                    <div className="cart-item-main">
                      <b>{item.name}</b>
                      <span>
                        {item.brand ? `${item.brand} · ` : ""}
                        {item.hp} · Qty {item.qty}
                      </span>
                      <small
                        style={{
                          color: item.blocked ? "#9d3440" : "#24705b",
                          fontWeight: 750,
                        }}
                      >
                        {stockStatus !== "ready"
                          ? "Checking availability…"
                          : item.available === 0
                            ? "Out of Stock"
                            : item.available < item.qty
                              ? `Only ${item.available} available — reduce your order`
                              : `${item.available} available`}
                      </small>
                    </div>
                    <div className="cart-item-side">
                      <b>{money(Number(item.price) * Number(item.qty))}</b>
                      <button
                        className="btn btn-soft"
                        type="button"
                        disabled={busy}
                        onClick={() => remove(item)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <aside className="surface cart-summary">
                <h2>Order summary</h2>
                <div className="cart-summary-row">
                  <span>Items</span>
                  <strong>{count}</strong>
                </div>
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className="cart-summary-row">
                  <span>Delivery</span>
                  <strong>Confirmed by store</strong>
                </div>
                <div className="cart-summary-row cart-total">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
                {blocked || syncError ? (
                  <button className="btn btn-dark" disabled type="button">
                    Checkout unavailable
                  </button>
                ) : (
                  <Link className="btn btn-dark" to="/checkout">
                    Proceed to Checkout
                  </Link>
                )}
              </aside>
            </div>
            <div className="cart-actions">
              <Link className="btn btn-soft" to="/shop">
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
