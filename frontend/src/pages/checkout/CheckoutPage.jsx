import {
  sanitizePersonName,
  sanitizeContactNumber,
  isValidPersonName,
} from "../../utils/fieldSanitizers.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../../../api/api.js";
import SavedAddressSelector from "../../components/common/SavedAddressSelector";
import ActionGuidance from "../../components/common/ActionGuidance.jsx";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import { getCart } from "../../utils/cartStore";

import {
  cartSelectionKey,
  getSelectedCartKeys,
  clearSelectedCartKeys,
} from "../../utils/cartSelection.js";

import { getDefaultCustomerAddress } from "../../utils/addressStore";
import {
  clearDirectCheckout,
  getDirectCheckout,
} from "../../utils/purchaseFlow";

import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/checkout.css";
import "../../styles/ecommerce/payment-transfers.css";

import {
  DELIVERY_AREAS,
  displayedDeliveryFee,
  completeDeliveryAddress,
  deliveryAddressConflict,
} from "../../utils/deliveryPricing.js";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const requestId = useRef(crypto.randomUUID());

  const directIntent = useMemo(() => getDirectCheckout(), []);

  const selectedCartKeys = useMemo(() => new Set(getSelectedCartKeys()), []);

  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(!directIntent);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");

  const [address, setAddress] = useState(
    () => getDefaultCustomerAddress()?.address || "",
  );

  const [notes, setNotes] = useState("");
  const [paymentCode, setPaymentCode] = useState("CASH");
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(true);
  const [paymentOptionsError, setPaymentOptionsError] = useState("");
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
        if (active) {
          setLoadError(err.response?.data?.message || "Cannot load your cart.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [directIntent]);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/customer/orders/payment-options", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        const methods = Array.isArray(data.methods) ? data.methods : [];

        setPaymentOptions(methods);

        setPaymentCode((current) =>
          methods.some((method) => method.code === current && method.available)
            ? current
            : methods.find((method) => method.available)?.code || "",
        );

        setPaymentOptionsError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setPaymentOptionsError(
          err.response?.data?.message ||
            "Cannot load payment methods. Refresh checkout.",
        );

        setPaymentOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPaymentOptionsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const availability = useMemo(
    () =>
      new Map(
        products.flatMap((product) =>
          (product.variants || []).map((variant) => [
            `${product.id}:${variant.hp}`,
            {
              ...variant,
              name: product.name,
              productId: product.id,
            },
          ]),
        ),
      ),
    [products],
  );

  const directItem = directIntent
    ? availability.get(`${directIntent.productId}:${directIntent.variant}`)
    : null;

  const directQty = Number(directIntent?.quantity);

  // For CART checkout, include ONLY checked items.
  // DIRECT Buy Now remains a separate checkout flow.
  const items = directIntent
    ? directItem &&
      Number.isInteger(directQty) &&
      directQty >= 1 &&
      directQty <= 99
      ? [
          {
            ...directItem,
            hp: directIntent.variant,
            qty: directQty,
          },
        ]
      : []
    : cart.filter((item) => selectedCartKeys.has(cartSelectionKey(item)));

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

  const deliveryFee = displayedDeliveryFee(deliveryArea);
  const grandTotal = subtotal + (deliveryFee ?? 0);
  const fullAddress = completeDeliveryAddress(address, deliveryArea);

  const addressConflict = deliveryAddressConflict(address, deliveryArea);

  const selectedMethod = paymentOptions.find(
    (method) => method.code === paymentCode,
  );

  const paymentReady =
    !paymentOptionsLoading &&
    !paymentOptionsError &&
    selectedMethod?.available === true;

  const count = items.reduce((sum, item) => sum + Number(item.qty), 0);

  const ready =
    !loading &&
    !loadError &&
    items.length > 0 &&
    !insufficient &&
    count <= 99 &&
    recipientName.trim().length >= 2 &&
    isValidPersonName(recipientName) &&
    (contactNumber.match(/\d/g) || []).length >= 7 &&
    /^[+0-9()\s-]+$/.test(contactNumber.trim()) &&
    address.trim().length >= 10 &&
    fullAddress.length <= 2000 &&
    !addressConflict &&
    paymentReady &&
    deliveryFee !== null &&
    Boolean(schedule);

  const orderReasons = [
    loading ? "Your cart is still loading." : null,

    loadError ? "Resolve the cart error above first." : null,

    items.length === 0
      ? directIntent
        ? "Choose an available product to order."
        : "No selected cart products found. Return to your cart and check the ones you want."
      : null,

    insufficient
      ? "Confirm product availability or change the quantity."
      : null,

    recipientName.trim().length < 2 || !isValidPersonName(recipientName)
      ? "Enter the recipient's full name using letters only."
      : null,

    (contactNumber.match(/\d/g) || []).length < 7 ||
    !/^[+0-9()\s-]+$/.test(contactNumber.trim())
      ? "Enter a reachable contact number."
      : null,

    deliveryArea === "OTHER"
      ? "Other locations need a delivery quotation from the store; online checkout cannot set custom fees."
      : !deliveryArea
        ? "Choose a delivery area."
        : null,

    address.trim().length < 10 ? "Enter the full delivery address." : null,

    addressConflict || null,

    fullAddress.length > 2000 ? "Delivery address is too long." : null,

    paymentOptionsLoading ? "Loading accepted payment methods." : null,

    paymentOptionsError || null,

    !paymentReady && !paymentOptionsLoading && !paymentOptionsError
      ? "Choose an available payment method."
      : null,

    !schedule ? "Select an available delivery appointment." : null,
  ].filter(Boolean);

  async function place(event) {
    event.preventDefault();

    if (placing || !ready) return;

    if (deliveryFee === null) {
      setError(
        "Choose a delivery area. Other locations need a confirmed quotation.",
      );
      return;
    }

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
        paymentCode,
        expectedTotal: Math.round(grandTotal * 100) / 100,
        deliveryArea,
        deliveryAddress: fullAddress,
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

            // Selected lines only, never the entire cart.
            items: items.map((item) => ({
              variantId: Number(item.variantId),
              quantity: Number(item.qty),
            })),
          };

      const { data } = await api.post("/api/customer/orders", payload);

      if (!data?.success || !data.order?.orderNumber) {
        throw new Error("Order was not confirmed. Please retry.");
      }

      if (directIntent) {
        clearDirectCheckout();
      } else {
        clearSelectedCartKeys();
      }

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

      const message = err.response?.data?.message || err.message || "";

      if (
        /stock|inventory|selected cart changed|insufficient units/i.test(
          message,
        )
      ) {
        refreshStock();
      }
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

            {!directIntent && (
              <p style={{ margin: "7px 0 0" }}>
                <Link to="/cart">Back to Cart · Edit selected products</Link>
              </p>
            )}

            <p className="section-copy">
              Choose Cash, GCash, or QR Ph. Online payments stay pending until
              the store confirms actual funds received.
            </p>
          </div>
        </div>

        {(error || loadError || (insufficient && !loading)) && (
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

            {insufficient && (
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
            )}
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
                    onChange={(event) =>
                      setRecipientName(sanitizePersonName(event.target.value))
                    }
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete="name"
                    disabled={placing}
                  />
                  <small>Use letters only for the recipient's name.</small>
                </label>

                <label className="form-group">
                  Phone number
                  <input
                    className="form-control"
                    type="tel"
                    value={contactNumber}
                    onChange={(event) =>
                      setContactNumber(
                        sanitizeContactNumber(event.target.value),
                      )
                    }
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
                Online payments are processed securely through PayMongo after
                the store confirms your order.
              </p>

              <label className="form-group" style={{ marginBottom: 15 }}>
                Delivery city / municipality (required)
                <select
                  className="form-control"
                  required
                  value={deliveryArea}
                  onChange={(event) => setDeliveryArea(event.target.value)}
                  disabled={placing}
                >
                  <option value="">Choose delivery area</option>

                  {DELIVERY_AREAS.map(([code, label, fee]) => (
                    <option key={code} value={code}>
                      {label} · {fee === 0 ? "FREE" : money(fee)}
                    </option>
                  ))}

                  <option value="OTHER">Other area — request quotation</option>
                </select>
                <small>
                  We'll add the selected city and province automatically.
                </small>
              </label>

              {deliveryArea === "OTHER" && (
                <p role="status">
                  This location needs a confirmed quotation. Contact the store
                  before checkout.
                </p>
              )}

              <SavedAddressSelector
                title="Delivery address"
                value={address}
                onChange={setAddress}
                disabled={placing}
              />

              {addressConflict && (
                <p role="alert" className="checkout-payment-error">
                  {addressConflict}
                </p>
              )}

              {address.trim().length >= 10 &&
                deliveryArea &&
                !addressConflict && (
                  <div className="checkout-address-preview" role="status">
                    <strong>Complete address to save</strong>

                    <span>{fullAddress}</span>
                  </div>
                )}

              <label className="form-group checkout-payment-method">
                Payment method (required)
                <select
                  className="form-control"
                  value={paymentCode}
                  disabled={placing || paymentOptionsLoading}
                  onChange={(event) => setPaymentCode(event.target.value)}
                  required
                >
                  {paymentOptions
                    .filter((method) => method.available)
                    .map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.name}
                      </option>
                    ))}
                </select>
                <small>
                  {paymentCode === "CASH"
                    ? "Pay cash when collected by the store. The order is unpaid until verified."
                    : "After your order is confirmed, visit My Account → Payments to open PayMongo's secure GCash / QR Ph checkout. Never share your PIN or OTP."}
                </small>
              </label>

              {paymentOptionsError && (
                <p role="alert" className="checkout-payment-error">
                  {paymentOptionsError}
                </p>
              )}

              {!paymentOptionsLoading &&
                !paymentOptions.some(
                  (method) => method.code !== "CASH" && method.available,
                ) && (
                  <small className="checkout-payment-help">
                    GCash and QR Ph will appear after the store activates
                    PayMongo and the relevant payment methods.
                  </small>
                )}
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

                <div className="checkout-notes-field">
                  <label htmlFor="checkout-notes">Notes (optional)</label>

                  <textarea
                    id="checkout-notes"
                    className="form-control"
                    rows={3}
                    maxLength={1000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={placing}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="surface checkout-summary">
            <h2>Order summary</h2>

            {!directIntent && (
              <p
                style={{
                  fontSize: ".83rem",
                  marginTop: 0,
                }}
              >
                Only your checked cart products are included below. Unchecked
                products stay in your cart.
              </p>
            )}

            {items.map((item, index) => (
              <div
                className="checkout-summary-row"
                key={`${item.productId}-${item.hp}-${index}`}
              >
                <span>
                  {item.name} · {item.hp} × {item.qty}
                </span>

                <strong>{money(item.price * item.qty)}</strong>
              </div>
            ))}

            {!items.length && (
              <p>
                No products selected.{" "}
                <Link to="/cart">Select items in your cart</Link>.
              </p>
            )}

            <div
              className="checkout-summary-row"
              style={{
                borderTop: "1px solid #d8e6ec",
                paddingTop: 12,
              }}
            >
              <span>Subtotal</span>

              <strong>{money(subtotal)}</strong>
            </div>

            <div className="checkout-summary-row">
              <span>Delivery fee</span>

              <strong>
                {deliveryFee === null
                  ? "Choose area"
                  : deliveryFee === 0
                    ? "FREE"
                    : money(deliveryFee)}
              </strong>
            </div>

            <div
              className="checkout-summary-row"
              style={{
                borderTop: "1px solid #d8e6ec",
                paddingTop: 12,
              }}
            >
              <strong>Grand total</strong>

              <strong>{deliveryFee === null ? "—" : money(grandTotal)}</strong>
            </div>

            <p
              style={{
                fontSize: ".79rem",
              }}
            >
              Availability and total are rechecked on the server before the
              order is saved.
            </p>

            <ActionGuidance
              title="Complete these before placing your order"
              reasons={orderReasons}
              readyText="All required checkout details are complete."
            />

            <button
              className="btn btn-dark"
              type="submit"
              disabled={!ready || placing || deliveryFee === null}
            >
              {placing ? "Placing order…" : "Place Order"}
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
}
