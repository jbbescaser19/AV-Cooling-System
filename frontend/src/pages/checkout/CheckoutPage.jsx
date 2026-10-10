import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import SavedAddressSelector from "../../components/common/SavedAddressSelector";

import { getCustomer } from "../../utils/authMock";

import { readCatalogProducts } from "../../utils/catalogStore";

import { getDefaultCustomerAddress } from "../../utils/addressStore";

import {
  PENDING_ACTIONS,
  clearDirectCheckout,
  getDirectCheckout,
  savePendingAction,
} from "../../utils/purchaseFlow";

import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

import "../../styles/ecommerce/pages.css";

export default function CheckoutPage() {
  const nav = useNavigate();

  const customer = getCustomer();

  const directIntent = useMemo(() => getDirectCheckout(), []);

  const cart = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("av_cart") || "[]");
    } catch {
      return [];
    }
  }, []);

  const directItem = useMemo(() => {
    if (!directIntent) {
      return null;
    }

    const product = readCatalogProducts().find(
      (item) => item.id === directIntent.productId,
    );

    const variant = product?.variants?.find(
      (item) => item.hp === directIntent.variant,
    );

    if (!product || !variant) {
      return null;
    }

    return {
      productId: product.id,

      name: product.name,

      brand: product.brand,

      hp: variant.hp,

      price: variant.price,

      srp: variant.srp,

      qty: Math.max(1, Number(directIntent.quantity) || 1),
    };
  }, [directIntent]);

  const isDirectCheckout = Boolean(directIntent);

  const items = isDirectCheckout ? (directItem ? [directItem] : []) : cart;

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items],
  );

  const [fulfillment, setFulfillment] = useState("Delivery");

  const [payment, setPayment] = useState("Cash");

  const [address, setAddress] = useState(
    () => getDefaultCustomerAddress()?.address || "",
  );

  const [pickupNotes, setPickupNotes] = useState("");

  const [schedule, setSchedule] = useState("");

  useEffect(() => {
    if (customer) {
      return;
    }

    savePendingAction({
      type: PENDING_ACTIONS.CHECKOUT_CART,
    });

    nav("/login", {
      replace: true,
    });
  }, [customer, nav]);

  if (!customer) {
    return null;
  }

  const place = (event) => {
    event.preventDefault();

    if (!items.length) {
      return;
    }

    if (fulfillment === "Delivery" && !address.trim()) {
      alert("Please select or add a delivery address.");

      return;
    }

    const id = uid("AV");

    const order = {
      id,

      date: new Date().toLocaleDateString("en-PH"),

      total: subtotal,

      status: payment === "Cash" ? "Pending Payment" : "Processing",

      type: fulfillment,

      payment,

      address: fulfillment === "Delivery" ? address : null,

      pickupNotes: fulfillment === "Pickup" ? pickupNotes : "",

      schedule,

      items,

      source: isDirectCheckout ? "Order Now" : "Cart",
    };

    const orders = loadMock("av_customer_orders", []);

    saveMock("av_customer_orders", [order, ...orders]);

    if (isDirectCheckout) {
      clearDirectCheckout();
    } else {
      localStorage.removeItem("av_cart");

      window.dispatchEvent(new Event("av-cart-updated"));
    }

    nav(`/order-confirmation/${id}`);
  };

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Checkout</div>

            <h1 className="page-title">Delivery, pickup, and payment</h1>

            <p className="section-copy">
              {isDirectCheckout
                ? "Complete your direct order without changing the products already in your cart."
                : "Review your cart and complete the order details."}
            </p>
          </div>
        </div>

        <form className="checkout-layout" onSubmit={place}>
          <div className="checkout-main">
            <section className="surface checkout-section">
              <h2>1. Fulfillment</h2>

              <div className="checkout-form-grid">
                <div className="form-group">
                  <label>Fulfillment method</label>

                  <select
                    className="form-control"
                    value={fulfillment}
                    onChange={(event) => setFulfillment(event.target.value)}
                  >
                    <option>Delivery</option>

                    <option>Pickup</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment method</label>

                  <select
                    className="form-control"
                    value={payment}
                    onChange={(event) => setPayment(event.target.value)}
                  >
                    <option>Cash</option>

                    <option>GCash</option>

                    <option>Bank Transfer</option>

                    <option>Online</option>

                    <option>Installment</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="surface checkout-section">
              <h2>
                2.{" "}
                {fulfillment === "Delivery"
                  ? "Delivery address"
                  : "Pickup details"}
              </h2>

              {fulfillment === "Delivery" ? (
                <SavedAddressSelector
                  title="Delivery address"
                  value={address}
                  onChange={setAddress}
                />
              ) : (
                <div className="form-group">
                  <label>Pickup notes (optional)</label>

                  <textarea
                    className="form-control"
                    rows="3"
                    value={pickupNotes}
                    onChange={(event) => setPickupNotes(event.target.value)}
                    placeholder="Example: Person who will pick up the order"
                  />
                </div>
              )}
            </section>

            <section className="surface checkout-section">
              <h2>3. Preferred schedule</h2>

              <input
                type="datetime-local"
                className="form-control"
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
              />
            </section>
          </div>

          <aside className="surface checkout-summary">
            <h2>Order summary</h2>

            {isDirectCheckout && (
              <span className="badge badge-blue">Order Now</span>
            )}

            {items.length ? (
              items.map((item, index) => (
                <div
                  className="checkout-summary-row"
                  key={`${item.productId}-${item.hp}-${index}`}
                >
                  <span>
                    {item.name} {item.hp} × {item.qty}
                  </span>

                  <strong>
                    ₱{(item.price * item.qty).toLocaleString("en-PH")}
                  </strong>
                </div>
              ))
            ) : (
              <div className="muted">No items available for checkout.</div>
            )}

            <div
              className="checkout-summary-row"
              style={{
                borderTop: "1px solid #d8e6ec",
                paddingTop: 12,
              }}
            >
              <span>Total</span>

              <strong>₱{subtotal.toLocaleString("en-PH")}</strong>
            </div>

            <button
              className="btn btn-dark"
              type="submit"
              disabled={!items.length}
            >
              Place Order
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
}
