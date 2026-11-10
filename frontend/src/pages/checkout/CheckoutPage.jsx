import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../../api/api.js";
import SavedAddressSelector from "../../components/common/SavedAddressSelector";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import { getCart } from "../../utils/cartStore";
import { getDefaultCustomerAddress } from "../../utils/addressStore";
import {
  clearDirectCheckout,
  getDirectCheckout,
} from "../../utils/purchaseFlow";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/checkout.css";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const requestId = useRef(crypto.randomUUID());
  const directIntent = useMemo(() => getDirectCheckout(), []);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(!directIntent);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState(
    () => getDefaultCustomerAddress()?.address || "",
  );
  const [notes, setNotes] = useState("");
  const [schedule, setSchedule] = useState("");
  const {
    products,
    status: stockStatus,
    refresh: refreshStock,
  } = useStorefrontCatalog();

  useEffect(() => {
    if (directIntent) return undefined;
    let active = true;
    setLoading(true);
    getCart()
      .then((result) => {
        if (!active) return;
        if (!result.authenticated || result.syncError) {
          setLoadError(result.syncError || "Please log in to check out.");
        } else {
          setCart(result.items);
        }
      })
      .catch((err) => {
        if (active)
          setLoadError(err.response?.data?.message || "Cannot load your cart.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [directIntent]);

  const availability = useMemo(
    () =>
      new Map(
        products.flatMap((p) =>
          (p.variants || []).map((v) => [
            `${p.id}:${v.hp}`,
            { ...v, name: p.name, productId: p.id },
          ]),
        ),
      ),
    [products],
  );

  const directItem = directIntent
    ? availability.get(`${directIntent.productId}:${directIntent.variant}`)
    : null;
  const directQty = Number(directIntent?.quantity);
  const items = directIntent
    ? directItem &&
      Number.isInteger(directQty) &&
      directQty >= 1 &&
      directQty <= 99
      ? [{ ...directItem, hp: directIntent.variant, qty: directQty }]
      : []
    : cart;

  const insufficient =
    stockStatus !== "ready" ||
    items.some((item) => {
      const stock = availability.get(`${item.productId}:${item.hp}`)?.stock;
      return !Number.isInteger(stock) || stock < Number(item.qty);
    });
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );
  const count = items.reduce((sum, item) => sum + Number(item.qty), 0);
  const ready =
    !loading &&
    !loadError &&
    items.length > 0 &&
    !insufficient &&
    count <= 99 &&
    Boolean(schedule);

  async function place(event) {
    event.preventDefault();
    if (placing || !ready) return;
    if (address.trim().length < 10) {
      setError("Enter your complete delivery address.");
      return;
    }
    setPlacing(true);
    setError("");
    try {
      const base = {
        requestId: requestId.current,
        recipientName: recipientName.trim(),
        contactNumber: contactNumber.trim(),
        fulfillment: "DELIVERY",
        paymentCode: "CASH",
        expectedTotal: Math.round(subtotal * 100) / 100,
        deliveryAddress: address.trim(),
        customerNotes: notes.trim(),
        preferredSchedule: schedule || null,
      };
      const payload = directIntent
        ? {
            ...base,
            source: "DIRECT",
            productId: directIntent.productId,
            hp: directIntent.variant,
            quantity: directQty,
          }
        : {
            ...base,
            source: "CART",
            items: items.map((item) => ({
              variantId: Number(item.variantId),
              quantity: Number(item.qty),
            })),
          };
      const { data } = await api.post("/api/customer/orders", payload);
      if (!data?.success || !data.order?.orderNumber)
        throw new Error("Order was not confirmed. Please retry.");
      if (directIntent) clearDirectCheckout();
      window.dispatchEvent(new Event("av-cart-updated"));
      navigate(
        `/order-confirmation/${encodeURIComponent(data.order.orderNumber)}`,
        { replace: true },
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not place order. Please try again.",
      );
      // Re-check because another customer may have purchased the last unit.
      refreshStock();
    } finally {
      setPlacing(false);
    }
  }

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Checkout</div>
            <h1 className="page-title">Delivery and payment</h1>
            <p className="section-copy">
              Your order is saved to MySQL after a final inventory check. Cash
              payment is collected when arranged with the store.
            </p>
          </div>
        </div>
        {(error || loadError || insufficient) && (
          <div
            className="surface"
            role="alert"
            style={{
              padding: 16,
              marginBottom: 14,
              border: "1px solid #e2bcc0",
            }}
          >
            {error ||
              loadError ||
              (stockStatus !== "ready"
                ? "Checking product stock. Ordering is disabled until availability is confirmed."
                : "One of these products is out of stock or you requested more than is available.")}
            <div>
              <button
                type="button"
                className="btn btn-soft"
                onClick={refreshStock}
              >
                Check stock again
              </button>
              <Link
                to={directIntent ? "/shop" : "/cart"}
                style={{ marginLeft: 12 }}
              >
                Review products
              </Link>
            </div>
          </div>
        )}
        <form className="checkout-layout" onSubmit={place}>
          <div className="checkout-main">
            <section className="surface checkout-section">
              <h2>1. Contact details</h2>
              <div className="checkout-form-grid">
                <label className="form-group">
                  Full name
                  <input
                    className="form-control"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete="name"
                    disabled={placing}
                  />
                </label>
                <label className="form-group">
                  Phone number
                  <input
                    className="form-control"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                    minLength={7}
                    maxLength={30}
                    placeholder="09XXXXXXXXX"
                    autoComplete="tel"
                    disabled={placing}
                  />
                </label>
              </div>
            </section>
            <section className="surface checkout-section">
              <h2>2. Delivery and payment</h2>
              <p>
                Delivery with installation, subject to staff confirmation.
                Payment: Cash (pending until collected).
              </p>
              <SavedAddressSelector
                title="Delivery address"
                value={address}
                onChange={setAddress}
                disabled={placing}
              />
            </section>
            <section className="surface checkout-section">
              <h2>3. Preferred schedule and notes</h2>
              <div className="checkout-form-grid">
                <AvailabilityPicker
                  value={schedule}
                  onChange={setSchedule}
                  disabled={placing}
                  label="Choose an available installation appointment"
                />
                <label className="form-group">
                  Notes (optional)
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={1000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={placing}
                  />
                </label>
              </div>
            </section>
          </div>
          <aside className="surface checkout-summary">
            <h2>Order summary</h2>
            {items.map((item, i) => (
              <div
                className="checkout-summary-row"
                key={`${item.productId}-${item.hp}-${i}`}
              >
                <span>
                  {item.name} · {item.hp} × {item.qty}
                </span>
                <strong>{money(item.price * item.qty)}</strong>
              </div>
            ))}
            {!items.length && <p>No products selected.</p>}
            <div
              className="checkout-summary-row"
              style={{ borderTop: "1px solid #d8e6ec", paddingTop: 12 }}
            >
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <p style={{ fontSize: ".79rem" }}>
              Availability and total are rechecked on the server before the
              order is saved.
            </p>
            <button
              className="btn btn-dark"
              type="submit"
              disabled={!ready || placing}
            >
              {placing ? "Placing order…" : "Place Order"}
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
}
