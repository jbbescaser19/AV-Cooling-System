import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../../../api/api.js";

import SavedAddressSelector from "../../components/common/SavedAddressSelector";
import CheckoutPhoneSelector from "../../components/checkout/CheckoutPhoneSelector";

import { getCart } from "../../utils/cartStore";
import { readCatalogProducts } from "../../utils/catalogStore";

import {
  cartItemKey,
  clearCheckoutSelection,
  readCheckoutSelection,
} from "../../utils/checkoutSelection";

import {
  clearDirectCheckout,
  getDirectCheckout,
} from "../../utils/purchaseFlow";

import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/checkout.css";

const money = (number) =>
  `₱${Number(number || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CheckoutPage() {
  const navigate = useNavigate();

  const checkoutId = useRef(crypto.randomUUID());

  const directIntent = useMemo(() => getDirectCheckout(), []);

  const checkoutKeys = useMemo(() => readCheckoutSelection() || [], []);

  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(!directIntent);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [placing, setPlacing] = useState(false);

  const [fulfillment, setFulfillment] = useState("DELIVERY");
  const [recipientName, setRecipientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(true);

  const [notes, setNotes] = useState("");
  const [schedule, setSchedule] = useState("");

  useEffect(() => {
    if (directIntent) return undefined;

    let active = true;

    getCart()
      .then((result) => {
        if (!active) return;

        if (!result.authenticated || result.syncError) {
          setLoadError(result.syncError || "Please sign in before checkout.");
        } else {
          setCart(result.items);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load your cart.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [directIntent]);

  const directItem = useMemo(() => {
    if (!directIntent) return null;

    const product = readCatalogProducts().find(
      (entry) => entry.id === directIntent.productId,
    );

    const variant = product?.variants?.find(
      (entry) => entry.hp === directIntent.variant,
    );

    const qty = Number(directIntent.quantity);

    if (!product || !variant || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return null;
    }

    return {
      productId: product.id,
      name: product.name,
      hp: variant.hp,
      qty,
      price: variant.price,
    };
  }, [directIntent]);

  const isDirect = Boolean(directIntent);

  const selectedSet = useMemo(() => new Set(checkoutKeys), [checkoutKeys]);

  const items = isDirect
    ? directItem
      ? [directItem]
      : []
    : cart.filter((item) => selectedSet.has(cartItemKey(item)));

  const missingItems =
    !isDirect &&
    (checkoutKeys.length === 0 || items.length !== checkoutKeys.length);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );

  const unitCount = items.reduce((sum, item) => sum + Number(item.qty), 0);

  const ready =
    !loading &&
    !loadError &&
    !missingItems &&
    items.length > 0 &&
    unitCount <= 99 &&
    (fulfillment !== "DELIVERY" || !addressLoading);

  async function placeOrder(event) {
    event.preventDefault();

    if (placing || !ready) return;

    if (!/^[+0-9 ()-]{7,30}$/.test(contactNumber.trim())) {
      setError("Enter a valid contact number for this order.");
      return;
    }

    if (fulfillment === "DELIVERY" && !address.trim()) {
      setError(
        "Select a saved delivery address or enter an address for this order.",
      );
      return;
    }

    setPlacing(true);
    setError("");

    try {
      const base = {
        requestId: checkoutId.current,
        recipientName: recipientName.trim(),
        contactNumber: contactNumber.trim(),
        fulfillment,
        paymentCode: "CASH",
        expectedTotal: Math.round(subtotal * 100) / 100,
        deliveryAddress: fulfillment === "DELIVERY" ? address.trim() : null,
        customerNotes: notes.trim(),
        preferredSchedule: schedule || null,
      };

      const payload = isDirect
        ? {
            ...base,
            source: "DIRECT",
            productId: directIntent.productId,
            hp: directIntent.variant,
            quantity: directItem.qty,
          }
        : {
            ...base,
            source: "CART",
            items: items.map((item) => ({
              variantId: Number(item.variantId),
              quantity: Number(item.qty),
            })),
          };

      const response = await api.post("/api/customer/orders", payload);

      if (!response.data?.success || !response.data?.order?.orderNumber) {
        throw new Error("The server did not confirm the order. Please retry.");
      }

      if (isDirect) {
        clearDirectCheckout();
      } else {
        clearCheckoutSelection();
      }

      window.dispatchEvent(new Event("av-cart-updated"));

      navigate(
        `/order-confirmation/${encodeURIComponent(
          response.data.order.orderNumber,
        )}`,
        { replace: true },
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Order could not be placed. Your cart has not been cleared.",
      );
    } finally {
      setPlacing(false);
    }
  }

  return (
    <section className="page-shell checkout-page">
      <div className="container">
        <div className="page-intro checkout-heading">
          <div>
            <div className="eyebrow">Secure order request</div>

            <h1 className="page-title">Checkout</h1>

            <p className="section-copy">
              Review your selected products and submit your order. Payment is
              collected on delivery or pickup.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="surface checkout-alert" role="alert">
            <p>{loadError}</p>

            {!isDirect && <Link to="/cart">Review cart</Link>}
          </div>
        )}

        {error && (
          <div className="surface checkout-alert" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!isDirect && missingItems && !loading && (
          <div className="surface checkout-alert" role="alert">
            Choose the items you want to buy before checking out.{" "}
            <Link to="/cart">Return to cart</Link>
          </div>
        )}

        <form className="checkout-layout" onSubmit={placeOrder}>
          <div className="checkout-main">
            <section className="surface checkout-section">
              <h2>1. Contact details</h2>

              <div className="checkout-form-grid">
                <label className="checkout-input-field">
                  Full name
                  <input
                    className="form-control"
                    autoComplete="name"
                    maxLength={150}
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Recipient's full name"
                    required
                    disabled={placing}
                  />
                </label>

                <CheckoutPhoneSelector
                  value={contactNumber}
                  onChange={setContactNumber}
                  disabled={placing}
                />
              </div>
            </section>

            <section className="surface checkout-section">
              <h2>2. Fulfillment</h2>

              <div className="checkout-form-grid">
                <label className="checkout-input-field">
                  Method
                  <select
                    className="form-control"
                    value={fulfillment}
                    onChange={(event) => setFulfillment(event.target.value)}
                    disabled={placing}
                  >
                    <option value="DELIVERY">Delivery</option>

                    <option value="PICKUP">Store pickup</option>
                  </select>
                </label>

                <label className="checkout-input-field">
                  Payment
                  <select className="form-control" value="CASH" disabled>
                    <option value="CASH">Cash on delivery / pickup</option>
                  </select>
                </label>
              </div>

              {fulfillment === "DELIVERY" && (
                <div className="checkout-address-field">
                  <SavedAddressSelector
                    title="Delivery address"
                    value={address}
                    onChange={setAddress}
                    onLoadingChange={setAddressLoading}
                    disabled={placing}
                  />
                </div>
              )}

              <p className="checkout-small-print">
                No online payment is collected. Staff will confirm availability
                and any delivery charges.
              </p>
            </section>

            <section className="surface checkout-section">
              <h2>3. Schedule and notes</h2>

              <div className="checkout-form-grid">
                <label className="checkout-input-field">
                  Preferred date and time (optional)
                  <input
                    className="form-control"
                    type="datetime-local"
                    value={schedule}
                    onChange={(event) => setSchedule(event.target.value)}
                    disabled={placing}
                  />
                </label>

                <label className="checkout-input-field">
                  Notes (optional)
                  <textarea
                    className="form-control"
                    rows={2}
                    maxLength={1000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Delivery instructions or pickup details"
                    disabled={placing}
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="surface checkout-summary checkout-order-summary">
            <div className="checkout-summary-heading">
              <h2>Order summary</h2>

              <span>
                {loading
                  ? "Loading…"
                  : `${items.length} product${items.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {items.map((item) => (
              <div className="checkout-summary-row" key={cartItemKey(item)}>
                <span>
                  {item.name} · {item.hp} × {item.qty}
                </span>

                <strong>{money(Number(item.price) * Number(item.qty))}</strong>
              </div>
            ))}

            {!items.length && (
              <p className="checkout-small-print">No products selected.</p>
            )}

            <div className="checkout-summary-row checkout-grand-total">
              <span>Product total</span>

              <strong>{money(subtotal)}</strong>
            </div>

            <p className="checkout-small-print">
              The server checks product prices before saving your order.
              Delivery fees, if any, are confirmed separately.
            </p>

            <button
              className="btn btn-dark checkout-place-button"
              type="submit"
              disabled={!ready || placing}
            >
              {placing ? "Submitting order…" : "Place order"}
            </button>

            {!isDirect && (
              <Link className="checkout-back-link" to="/cart">
                Back to selected cart
              </Link>
            )}
          </aside>
        </form>
      </div>
    </section>
  );
}
