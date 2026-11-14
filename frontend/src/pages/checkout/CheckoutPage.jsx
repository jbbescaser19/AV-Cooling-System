import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../../api/api.js";
import SavedAddressSelector from "../../components/common/SavedAddressSelector";
import ActionGuidance from "../../components/common/ActionGuidance.jsx";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import { getCart } from "../../utils/cartStore";
import {
  sanitizePersonName,
  sanitizeContactNumber,
} from "../../utils/fieldSanitizers.js";
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
  const [contactSource, setContactSource] = useState("NEW");
  const [profileContact, setProfileContact] = useState(null);
  const [profileContactLoading, setProfileContactLoading] = useState(true);
  const [profileContactError, setProfileContactError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const contactChoiceTouched = useRef(false);
  const manualContact = useRef({ name: "", phone: "" });
  const [deliveryArea, setDeliveryArea] = useState("");
  const [address, setAddress] = useState("");
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

  // The profile is the source of saved recipient contact details. Choosing
  // another recipient changes only this order, never the customer's profile.
  useEffect(() => {
    const controller = new AbortController();
    setProfileContactLoading(true);
    setProfileContactError("");

    api
      .get("/api/customer/account/profile", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data?.success || !data.user) {
          throw new Error("Could not read your profile contact details.");
        }
        const saved = {
          name: sanitizePersonName(data.user.name).trim(),
          phone: sanitizeContactNumber(data.user.phone).trim(),
        };
        const hasName = saved.name.length >= 2;
        const hasPhone = (saved.phone.match(/\d/g) || []).length >= 7;
        setProfileContact(saved);
        if (hasName && hasPhone && !contactChoiceTouched.current) {
          setContactSource("PROFILE");
          setRecipientName(saved.name);
          setContactNumber(saved.phone);
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setProfileContactError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load saved contact details.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileContactLoading(false);
      });
    return () => controller.abort();
  }, [profileRetry]);

  function changeContactSource(nextSource) {
    contactChoiceTouched.current = true;
    if (nextSource === "PROFILE" && profileContact) {
      const complete =
        profileContact.name.length >= 2 &&
        (profileContact.phone.match(/\d/g) || []).length >= 7;
      if (!complete) return;
      setContactSource("PROFILE");
      setRecipientName(profileContact.name);
      setContactNumber(profileContact.phone);
    } else {
      setContactSource("NEW");
      setRecipientName(manualContact.current.name);
      setContactNumber(manualContact.current.phone);
    }
  }

  function changeRecipientName(raw) {
    const next = sanitizePersonName(raw);
    manualContact.current.name = next;
    setRecipientName(next);
  }

  function changeContactNumber(raw) {
    const next = sanitizeContactNumber(raw);
    manualContact.current.phone = next;
    setContactNumber(next);
  }

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
          methods.some((m) => m.code === current && m.available)
            ? current
            : methods.find((m) => m.available)?.code || "",
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
        if (!controller.signal.aborted) setPaymentOptionsLoading(false);
      });
    return () => controller.abort();
  }, []);

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
    items.length === 0 ? "Add a product before checkout." : null,
    insufficient
      ? "Confirm product availability or change the quantity."
      : null,
    recipientName.trim().length < 2 ? "Enter the recipient's full name." : null,
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
      // An address or payment-method validation error is not a stock error.
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
              <label className="form-group">
                Recipient name and phone number
                <select
                  className="form-control"
                  value={contactSource}
                  disabled={placing || profileContactLoading}
                  onChange={(event) => changeContactSource(event.target.value)}
                >
                  {profileContact &&
                    profileContact.name.length >= 2 &&
                    (profileContact.phone.match(/\d/g) || []).length >= 7 && (
                      <option value="PROFILE">
                        Use my profile name and phone
                      </option>
                    )}
                  <option value="NEW">Enter a different name and phone</option>
                </select>
              </label>
              {profileContactLoading && (
                <p className="checkout-payment-help" role="status">
                  Checking saved profile details…
                </p>
              )}
              {!profileContactLoading && profileContactError && (
                <div className="checkout-payment-help" role="status">
                  <p>
                    {profileContactError} You can enter new contact details.
                  </p>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={placing}
                    onClick={() => setProfileRetry((count) => count + 1)}
                  >
                    Try loading profile again
                  </button>
                </div>
              )}
              {!profileContactLoading &&
                !profileContactError &&
                profileContact &&
                (!profileContact.name ||
                  (profileContact.phone.match(/\d/g) || []).length < 7) && (
                  <p className="checkout-payment-help">
                    Your profile does not have complete contact information.
                    Enter a name and phone number for this order.
                  </p>
                )}
              <div className="checkout-form-grid">
                <label className="form-group">
                  Full name
                  <input
                    className="form-control"
                    value={recipientName}
                    onChange={(event) =>
                      changeRecipientName(event.target.value)
                    }
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete={contactSource === "PROFILE" ? "off" : "name"}
                    readOnly={contactSource === "PROFILE"}
                    disabled={placing}
                  />
                </label>
                <label className="form-group">
                  Phone number
                  <input
                    className="form-control"
                    type="tel"
                    inputMode="tel"
                    value={contactNumber}
                    onChange={(event) =>
                      changeContactNumber(event.target.value)
                    }
                    required
                    minLength={7}
                    maxLength={30}
                    placeholder="09XXXXXXXXX"
                    autoComplete={contactSource === "PROFILE" ? "off" : "tel"}
                    readOnly={contactSource === "PROFILE"}
                    disabled={placing}
                  />
                </label>
              </div>
              <p className="checkout-payment-help">
                {contactSource === "PROFILE"
                  ? "Using the full name and phone number saved in My Account → Profile. Select Enter a different name and phone to use a different recipient."
                  : "These contact details apply to this order only. Your profile information will not change."}
              </p>
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
                autoSelectDefault={false}
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
                  (m) => m.code !== "CASH" && m.available,
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
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={placing}
                  />
                </div>
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
              style={{ borderTop: "1px solid #d8e6ec", paddingTop: 12 }}
            >
              <strong>Grand total</strong>
              <strong>{deliveryFee === null ? "—" : money(grandTotal)}</strong>
            </div>
            <p style={{ fontSize: ".79rem" }}>
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
