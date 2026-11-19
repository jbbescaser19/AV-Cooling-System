import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";

import api from "../../../api/api.js";

import {
  sanitizePersonName,
  sanitizeContactNumber,
} from "../../utils/fieldSanitizers.js";

import { confirmAction } from "../../utils/confirmAction.js";
import { getStaff } from "../../utils/authMock";

import {
  DELIVERY_AREAS,
  displayedDeliveryFee,
  completeDeliveryAddress,
  deliveryAddressConflict,
} from "../../utils/deliveryPricing.js";

import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import POSReasonField from "../../components/management/POSReasonField.jsx";
import POSResultModal from "../../components/management/POSResultModal.jsx";
import POSWalkInService from "../../components/management/POSWalkInService.jsx";
import ReturningCustomerSearch from "../../components/management/ReturningCustomerSearch.jsx";
import ActionGuidance from "../../components/common/ActionGuidance.jsx";

import "../../styles/management/sales-live.css";
import "../../styles/management/pos-enhancements.css";
import "../../styles/management/pos-customer-fees.css";
import "../../styles/ecommerce/paymongo.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

export default function POSPage() {
  const [posTab, setPosTab] = useState("products");
  const [catalog, setCatalog] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(["CASH"]);
  const [paymentCode, setPaymentCode] = useState("CASH");

  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [variantId, setVariantId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [payLater, setPayLater] = useState(false);

  const [additionalFee, setAdditionalFee] = useState("0");
  const [additionalFeeReason, setAdditionalFeeReason] = useState("");

  const [cashReceived, setCashReceived] = useState("");
  const [cashVerified, setCashVerified] = useState(false);

  const [withInstallation, setWithInstallation] = useState(false);
  const [withDelivery, setWithDelivery] = useState(false);
  const [deliveryArea, setDeliveryArea] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const requestKey = useRef(crypto.randomUUID());

  // Once loaded, the product list stays mounted during refreshes.
  const hasLoadedCatalog = useRef(false);

  const staff = getStaff();

  const canManage = ["OWNER", "MANAGER"].includes(staff?.role);

  const mayDiscount = ["OWNER", "MANAGER", "SALES_CASHIER"].includes(
    staff?.role,
  );

  const cashNow = paymentCode === "CASH" && !payLater;

  const submitLock = useRef(false);

  useRealtimeRefresh(
    ["inventory", "catalog", "payments", "customers"],
    setRefresh,
  );

  useEffect(() => {
    const controller = new AbortController();

    if (!hasLoadedCatalog.current) {
      setLoading(true);
    }

    api
      .get("/api/management/sales/catalog", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        if (!data?.success || !Array.isArray(data.items)) {
          throw new Error("Invalid POS catalog response.");
        }

        hasLoadedCatalog.current = true;

        setCatalogAvailable(true);
        setCatalog(data.items);

        setPaymentMethods(
          Array.isArray(data.paymentMethods) ? data.paymentMethods : ["CASH"],
        );

        setError("");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;

        setCatalogAvailable(false);

        setError(
          requestError.response?.data?.message ||
            "Could not refresh available products. Check your connection.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return catalog.filter((product) =>
      `${product.brand} ${product.productName} ${product.model} ${product.horsepower}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalog, search]);

  const brands = useMemo(
    () =>
      [...new Set(filtered.map((product) => product.brand))].sort((a, b) =>
        String(a).localeCompare(String(b)),
      ),
    [filtered],
  );

  const models = useMemo(() => {
    const grouped = new Map();

    for (const product of filtered.filter((item) => item.brand === brand)) {
      const key = `${product.model}::${product.productName}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: `${product.model} · ${product.productName}`,
        });
      }
    }

    return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, brand]);

  const variants = useMemo(
    () =>
      filtered
        .filter(
          (product) =>
            product.brand === brand &&
            `${product.model}::${product.productName}` === modelKey,
        )
        .sort((a, b) => Number(a.horsepower) - Number(b.horsepower)),
    [filtered, brand, modelKey],
  );

  const chosen = variants.find(
    (product) => String(product.variantId) === variantId,
  );

  const rows = useMemo(
    () =>
      cart
        .map((line) => ({
          ...line,

          product: catalog.find(
            (product) => String(product.variantId) === String(line.variantId),
          ),
        }))
        .filter((line) => line.product),
    [cart, catalog],
  );

  const quickProducts = useMemo(
    () =>
      [...filtered]
        .sort(
          (a, b) =>
            (Number(b.available) > 0) - (Number(a.available) > 0) ||
            String(a.brand).localeCompare(String(b.brand)) ||
            String(a.model).localeCompare(String(b.model)) ||
            Number(a.horsepower) - Number(b.horsepower),
        )
        .slice(0, 40),
    [filtered],
  );

  const subtotal =
    rows.reduce(
      (sum, line) =>
        sum + Math.round(Number(line.product.price) * 100) * line.quantity,
      0,
    ) / 100;

  const reduction = Number(discount) || 0;
  const fee = Number(additionalFee) || 0;

  const validDiscount =
    Number.isFinite(Number(discount)) &&
    reduction >= 0 &&
    reduction < subtotal &&
    (reduction > 0
      ? discountReason.trim().length >= 5
      : !discountReason.trim());

  const validFee =
    Number.isFinite(Number(additionalFee)) &&
    fee >= 0 &&
    fee <= 99999.99 &&
    (fee === 0
      ? !additionalFeeReason.trim()
      : additionalFeeReason.trim().length >= 5);

  const validPhone =
    (customerPhone.match(/\d/g) || []).length >= 7 &&
    /^[+0-9()\s-]+$/.test(customerPhone.trim());

  const remoteDelivery = withDelivery && deliveryArea === "OTHER";

  const completedAddress =
    withDelivery && !remoteDelivery
      ? completeDeliveryAddress(serviceAddress, deliveryArea)
      : serviceAddress.trim();

  const addressConflict =
    withDelivery && !remoteDelivery
      ? deliveryAddressConflict(serviceAddress, deliveryArea)
      : "";

  const deliveryFee = withDelivery
    ? remoteDelivery
      ? 0
      : displayedDeliveryFee(deliveryArea)
    : 0;

  const total = Math.max(
    0,
    Math.round((subtotal - reduction + (deliveryFee ?? 0) + fee) * 100) / 100,
  );

  const cash = Number(cashReceived) || 0;

  const change = Math.max(0, Math.round((cash - total) * 100) / 100);

  useEffect(() => {
    setCashVerified(false);
  }, [total, cashReceived, paymentCode, payLater]);

  const canSave =
    !loading &&
    catalogAvailable &&
    !submitting &&
    paymentMethods.includes(paymentCode) &&
    rows.length > 0 &&
    rows.length === cart.length &&
    customerName.trim().length >= 2 &&
    validPhone &&
    validFee &&
    validDiscount &&
    (!reduction || mayDiscount) &&
    (!cashNow || (cash >= total && cashVerified)) &&
    (!payLater || paymentCode === "CASH") &&
    rows.every(
      (line) =>
        Number(line.product.horsepower) > 0 &&
        line.quantity <= Number(line.product.available),
    ) &&
    (!withDelivery ||
      (deliveryFee !== null &&
        Boolean(scheduledStart) &&
        serviceAddress.trim().length >= (remoteDelivery ? 10 : 5) &&
        completedAddress.length <= 2000 &&
        !addressConflict &&
        (!remoteDelivery || fee > 0)));

  const checkoutReasons = [
    loading ? "Product catalog is still loading." : null,

    !catalogAvailable && !loading
      ? "Product stock could not be verified. Refresh the catalog."
      : null,

    !paymentMethods.includes(paymentCode) && !loading
      ? "Selected payment method is unavailable."
      : null,

    rows.length === 0 ? "Add at least one product to the sale." : null,

    rows.length !== cart.length ||
    rows.some((line) => line.quantity > Number(line.product.available))
      ? "Stock or catalog changed. Review your cart."
      : null,

    customerName.trim().length < 2
      ? "Enter or select the customer's name."
      : null,

    !validPhone
      ? "Enter a valid phone number so the customer can be contacted."
      : null,

    (reduction < 0 || reduction >= subtotal) && rows.length
      ? "Discount must be less than the product subtotal."
      : null,

    reduction > 0 && discountReason.trim().length < 5
      ? "Select a discount reason."
      : null,

    !validFee
      ? "Enter a valid extra fee and reason (at least 5 characters), or remove both."
      : null,

    withDelivery && !deliveryArea ? "Choose a delivery area." : null,

    remoteDelivery && fee <= 0
      ? "For Other area, enter the agreed additional delivery fee."
      : null,

    withDelivery && serviceAddress.trim().length < (remoteDelivery ? 10 : 5)
      ? "Enter the full delivery address."
      : null,

    withDelivery && !scheduledStart
      ? "Select an available delivery appointment."
      : null,

    addressConflict || null,

    withDelivery && completedAddress.length > 2000
      ? "The delivery address is too long."
      : null,

    cashNow && cash < total
      ? `Cash received must cover ${money(total)}.`
      : null,

    cashNow && !cashVerified
      ? "Count and verify cash before recording a cash sale."
      : null,
  ].filter(Boolean);

  function add(product) {
    const available = Math.max(0, Number(product.available) || 0);

    if (
      available < 1 ||
      !(Number(product.horsepower) > 0) ||
      submitting ||
      !catalogAvailable
    ) {
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (line) => String(line.variantId) === String(product.variantId),
      );

      if (!existing) {
        return [
          ...current,
          {
            variantId: product.variantId,
            quantity: 1,
          },
        ];
      }

      return current.map((line) =>
        String(line.variantId) === String(product.variantId)
          ? {
              ...line,

              quantity: Math.min(available, 99, line.quantity + 1),
            }
          : line,
      );
    });

    setCashVerified(false);
  }

  function quantity(id, amount) {
    if (!catalogAvailable || submitting) return;

    setCart((current) =>
      current
        .map((line) => {
          if (String(line.variantId) !== String(id)) {
            return line;
          }

          const available =
            Number(
              catalog.find(
                (product) => String(product.variantId) === String(id),
              )?.available,
            ) || 0;

          return {
            ...line,

            quantity: Math.max(
              0,
              Math.min(99, available, line.quantity + amount),
            ),
          };
        })
        .filter((line) => line.quantity > 0),
    );

    setCashVerified(false);
  }

  async function checkout(event) {
    event.preventDefault();

    if (!canSave || submitLock.current) return;

    submitLock.current = true;

    setSubmitting(true);

    const approved = await confirmAction(
      `${remoteDelivery ? "First confirm this delivery is possible.\n\n" : ""}${
        payLater
          ? `Save an unpaid cash order for ${money(total)}?`
          : cashNow
            ? `Confirm that ${money(cash)} cash was received?`
            : `Create a PENDING ${money(total)} order and reserve stock? You must generate a PayMongo link afterward.`
      }`,
    );

    if (!approved) {
      submitLock.current = false;
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data } = await api.post("/api/management/sales/pos", {
        requestKey: requestKey.current,

        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),

        items: cart,

        discount: Math.round(reduction * 100) / 100,

        discountReason: discountReason.trim(),

        payLater,

        additionalFee: Math.round(fee * 100) / 100,

        additionalFeeReason: additionalFeeReason.trim(),

        paymentCode,

        cashReceived: cashNow ? Math.round(cash * 100) / 100 : 0,

        delivery: withDelivery,

        deliveryArea: withDelivery ? deliveryArea : null,

        installationIncluded: withInstallation,

        scheduledStart: withDelivery ? scheduledStart : null,

        serviceAddress: withDelivery ? completedAddress : "",

        technicianIds: withDelivery && canManage ? technicianIds : [],
      });

      if (!data.success || !data.receipt) {
        throw new Error("Sale was not confirmed.");
      }

      setReceipt(data.receipt);

      requestKey.current = crypto.randomUUID();

      setCart([]);
      setDiscount("0");
      setDiscountReason("");
      setPayLater(false);
      setAdditionalFee("0");
      setAdditionalFeeReason("");
      setCashReceived("");
      setCashVerified(false);
      setCustomerName("");
      setCustomerPhone("");
      setWithInstallation(false);
      setWithDelivery(false);
      setDeliveryArea("");
      setScheduledStart("");
      setServiceAddress("");
      setTechnicianIds([]);

      setRefresh((value) => value + 1);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Cannot complete sale.",
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="pos-page-shell">
      <nav className="pos-mode-switch" aria-label="POS sale type">
        <button
          type="button"
          className={posTab === "products" ? "is-selected" : ""}
          aria-current={posTab === "products" ? "page" : undefined}
          onClick={() => setPosTab("products")}
        >
          <ShoppingCart size={17} />
          Product Sale
        </button>

        <button
          type="button"
          className={posTab === "services" ? "is-selected" : ""}
          aria-current={posTab === "services" ? "page" : undefined}
          onClick={() => setPosTab("services")}
        >
          <Wrench size={17} />
          Walk-in Service Booking
        </button>
      </nav>

      {posTab === "services" ? (
        <POSWalkInService />
      ) : (
        <div className="sales-ui pos-product-page">
          <header className="sales-hero">
            <div>
              <span className="sales-kicker">
                <ShoppingCart size={16} />
                LIVE MYSQL POS
              </span>

              <h1>Walk-in product sales</h1>

              <p>Choose products, confirm payment, and issue the receipt.</p>
            </div>

            <button
              type="button"
              className="sales-refresh"
              disabled={loading || submitting}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={17} />
              Refresh stock
            </button>
          </header>

          {error && (
            <p className="sales-error" role="alert">
              {error}
            </p>
          )}

          {!paymentMethods.length && !loading && (
            <p className="sales-error" role="status">
              No payment method is enabled. Contact an Owner or Manager.
            </p>
          )}

          <div className="sales-columns pos-product-columns">
            {/* CUSTOMER DETAILS */}

            <section
              className="sales-panel sales-checkout"
              style={{ gridColumn: "1 / -1" }}
              aria-label="Customer details"
            >
              <div className="sales-section-head">
                <h2>Customer details</h2>
              </div>

              <ReturningCustomerSearch
                disabled={submitting}
                onSelect={(person) => {
                  setCustomerName(person.name);
                  setCustomerPhone(person.phone);

                  if (person.address) {
                    setServiceAddress(person.address);
                  }

                  setCashVerified(false);
                }}
              />

              <div className="pos-walkin-fields pos-walkin-fields--two">
                <label>
                  Customer name
                  <input
                    form="pos-product-sale-form"
                    value={customerName}
                    maxLength={150}
                    required
                    onChange={(event) => {
                      setCustomerName(sanitizePersonName(event.target.value));

                      setCashVerified(false);
                    }}
                  />
                  <small>
                    Letters only. Numbers are not allowed in customer names.
                  </small>
                </label>

                <label>
                  Contact number (required)
                  <input
                    form="pos-product-sale-form"
                    type="tel"
                    value={customerPhone}
                    minLength={7}
                    maxLength={30}
                    required
                    autoComplete="tel"
                    placeholder="e.g. 09XXXXXXXXX"
                    onChange={(event) => {
                      setCustomerPhone(
                        sanitizeContactNumber(event.target.value),
                      );

                      setCashVerified(false);
                    }}
                  />
                  {!validPhone && customerPhone.length > 0 && (
                    <small className="pos-fee-fields__error">
                      Enter a reachable contact number (at least 7 digits).
                    </small>
                  )}
                </label>
              </div>
            </section>

            {/* PRODUCTS */}

            <section className="sales-panel pos-products-panel">
              <div className="sales-section-head">
                <h2>Products</h2>

                <span>{catalog.length} variants</span>
              </div>

              <label className="sales-search">
                <Search size={18} />

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setBrand("");
                    setModelKey("");
                    setVariantId("");
                  }}
                  placeholder="Search brand, model, or horsepower"
                  aria-label="Search products"
                />
              </label>

              {loading ? (
                <p className="sales-empty">Loading products…</p>
              ) : (
                <div className="pos-product-picker">
                  <label>
                    1. Brand
                    <select
                      value={brand}
                      onChange={(event) => {
                        setBrand(event.target.value);
                        setModelKey("");
                        setVariantId("");
                      }}
                    >
                      <option value="">Choose brand</option>

                      {brands.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    2. Model
                    <select
                      value={modelKey}
                      disabled={!brand}
                      onChange={(event) => {
                        setModelKey(event.target.value);
                        setVariantId("");
                      }}
                    >
                      <option value="">Choose model</option>

                      {models.map((value) => (
                        <option key={value.key} value={value.key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    3. Horsepower (HP) *
                    <select
                      value={variantId}
                      disabled={!modelKey}
                      onChange={(event) => setVariantId(event.target.value)}
                    >
                      <option value="">Choose HP</option>

                      {variants.map((value) => (
                        <option key={value.variantId} value={value.variantId}>
                          {value.horsepower} HP · {money(value.price)} ·{" "}
                          {value.available} left
                        </option>
                      ))}
                    </select>
                  </label>

                  {chosen && (
                    <div className="pos-chosen-product">
                      <div>
                        <small>
                          {chosen.brand} · {chosen.model}
                        </small>

                        <strong>
                          {chosen.productName} · {chosen.horsepower} HP
                        </strong>

                        <b>{money(chosen.price)}</b>

                        <small>
                          {Number(chosen.available) > 0
                            ? `${chosen.available} in stock`
                            : "Out of stock"}
                        </small>
                      </div>

                      <button
                        type="button"
                        onClick={() => add(chosen)}
                        disabled={
                          submitting ||
                          !catalogAvailable ||
                          Number(chosen.available) <=
                            (cart.find(
                              (line) =>
                                String(line.variantId) ===
                                String(chosen.variantId),
                            )?.quantity || 0)
                        }
                      >
                        <Plus size={16} />
                        Add to sale
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pos-quick-products">
                <div className="pos-quick-products__head">
                  <div>
                    <h3>Quick-add from available products</h3>

                    <p>
                      Browse or search above. Select a product to add it
                      directly.
                    </p>
                  </div>

                  <span>{filtered.length} results</span>
                </div>

                {loading ? (
                  <p className="sales-empty">Loading available stock…</p>
                ) : quickProducts.length ? (
                  <div className="pos-quick-products__list">
                    {quickProducts.map((product) => {
                      const inCart =
                        cart.find(
                          (line) =>
                            String(line.variantId) ===
                            String(product.variantId),
                        )?.quantity || 0;

                      const disabled =
                        submitting ||
                        !catalogAvailable ||
                        Number(product.available) <= inCart;

                      return (
                        <div
                          className="pos-quick-product"
                          key={product.variantId}
                        >
                          <div className="pos-quick-product__details">
                            <small>
                              {product.brand} · {product.model}
                            </small>

                            <strong>
                              {product.productName} · {product.horsepower} HP
                            </strong>

                            <span>
                              {money(product.price)} ·{" "}
                              {Number(product.available) > 0
                                ? `${product.available} in stock`
                                : "Out of stock"}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="pos-quick-product__add"
                            aria-label={`Add ${product.productName} ${product.horsepower} HP to sale`}
                            title="Add to current sale"
                            disabled={disabled}
                            onClick={() => add(product)}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="sales-empty">No products match your search.</p>
                )}
              </div>
            </section>

            {/* CURRENT SALE */}

            <form
              id="pos-product-sale-form"
              className="sales-panel sales-checkout"
              onSubmit={checkout}
            >
              <div className="sales-section-head">
                <h2>Current sale</h2>

                <span>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="sales-empty">
                  Choose a product from the left to begin the sale.
                </p>
              ) : (
                <div className="sales-cart">
                  {rows.map(({ variantId: id, quantity: count, product }) => (
                    <div className="sales-cart-line" key={id}>
                      <div>
                        <strong>{product.productName}</strong>

                        <small>
                          {product.horsepower} HP · {money(product.price)} each
                        </small>
                      </div>

                      <div className="sales-quantity">
                        <button
                          type="button"
                          onClick={() => quantity(id, -1)}
                          aria-label={`Remove one ${product.productName}`}
                        >
                          <Minus size={14} />
                        </button>

                        <b>{count}</b>

                        <button
                          type="button"
                          onClick={() => quantity(id, 1)}
                          disabled={
                            !catalogAvailable ||
                            count >= Number(product.available)
                          }
                          aria-label={`Add one ${product.productName}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="sales-plain"
                        onClick={() => {
                          setCart((current) =>
                            current.filter(
                              (line) => String(line.variantId) !== String(id),
                            ),
                          );

                          setCashVerified(false);
                        }}
                        aria-label={`Remove ${product.productName} from sale`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="sales-checkline">
                <input
                  type="checkbox"
                  checked={withDelivery}
                  disabled={submitting}
                  onChange={(event) => {
                    setWithDelivery(event.target.checked);

                    if (!event.target.checked) {
                      setWithInstallation(false);
                      setDeliveryArea("");
                      setScheduledStart("");
                      setServiceAddress("");
                      setTechnicianIds([]);
                    }

                    setCashVerified(false);
                  }}
                />

                <span>Arrange delivery to the customer</span>
              </label>

              <label className="sales-checkline">
                <input
                  type="checkbox"
                  checked={withInstallation}
                  disabled={submitting}
                  onChange={(event) => {
                    setWithInstallation(event.target.checked);

                    if (event.target.checked) {
                      setWithDelivery(true);
                    }

                    setCashVerified(false);
                  }}
                />

                <span>Book an installation for this walk-in purchase</span>
              </label>

              {withDelivery && (
                <div className="pos-installation-fields">
                  <label>
                    Delivery city / municipality
                    <select
                      value={deliveryArea}
                      required
                      onChange={(event) => {
                        setDeliveryArea(event.target.value);

                        setCashVerified(false);
                      }}
                    >
                      <option value="">Choose delivery area</option>

                      {DELIVERY_AREAS.map(([code, city, amount]) => (
                        <option key={code} value={code}>
                          {city} · {amount === 0 ? "FREE" : money(amount)}
                        </option>
                      ))}

                      <option value="OTHER">
                        Other area — agreed custom delivery fee
                      </option>
                    </select>
                    {remoteDelivery && (
                      <p className="pos-fee-fields__hint" role="status">
                        Outside the usual delivery areas. First confirm that the
                        trip is possible and agree on a price with the customer.
                        Enter that price as an Additional fee, with a reason.
                        The normal delivery fee will be ₱0; the custom fee is
                        shown separately.
                      </p>
                    )}
                  </label>

                  <AvailabilityPicker
                    value={scheduledStart}
                    onChange={(value) => {
                      setScheduledStart(value);
                      setCashVerified(false);
                    }}
                    disabled={submitting}
                    label={
                      withInstallation
                        ? "Choose available delivery and installation time"
                        : "Choose available delivery time"
                    }
                  />

                  <label>
                    Delivery / installation address
                    <textarea
                      value={serviceAddress}
                      minLength={5}
                      maxLength={2000}
                      required
                      onChange={(event) =>
                        setServiceAddress(event.target.value)
                      }
                      placeholder="Customer's complete delivery address"
                    />
                  </label>

                  {addressConflict && (
                    <p className="sales-error" role="alert">
                      {addressConflict}
                    </p>
                  )}

                  {!!completedAddress && !addressConflict && (
                    <div className="pos-delivery-address-preview" role="status">
                      <strong>Delivery address to be saved</strong>

                      <span>{completedAddress}</span>

                      <small>
                        Confirm this location before creating the sale.
                      </small>
                    </div>
                  )}

                  {canManage ? (
                    <TechnicianTeamPicker
                      scheduledStart={scheduledStart}
                      value={technicianIds}
                      onChange={setTechnicianIds}
                      disabled={submitting}
                    />
                  ) : (
                    <p className="sales-checkline" role="note">
                      The appointment will be reserved now. An Owner or Manager
                      assigns the team before delivery begins.
                    </p>
                  )}
                </div>
              )}

              <div className="sales-totals">
                <span>Subtotal</span>

                <strong>{money(subtotal)}</strong>
              </div>

              {withDelivery && (
                <div className="sales-totals">
                  <span>Delivery fee</span>

                  <strong>
                    {deliveryFee === null
                      ? "Needs quotation"
                      : deliveryFee === 0
                        ? "FREE"
                        : money(deliveryFee)}
                  </strong>
                </div>
              )}

              {mayDiscount && (
                <>
                  <label>
                    Discount (₱)
                    <input
                      type="number"
                      min="0"
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={(event) => {
                        setDiscount(event.target.value);

                        if (Number(event.target.value) <= 0) {
                          setDiscountReason("");
                        }

                        setCashVerified(false);
                      }}
                    />
                  </label>

                  {reduction > 0 && (
                    <POSReasonField
                      kind="discount"
                      value={discountReason}
                      onChange={(value) => {
                        setDiscountReason(value);
                        setCashVerified(false);
                      }}
                      disabled={submitting}
                    />
                  )}
                </>
              )}

              <div className="pos-fee-fields">
                <div className="pos-fee-fields__heading">
                  <strong>Additional fee (optional)</strong>

                  <small>
                    For agreed extra travel or special handling. Tell the
                    customer before charging.
                  </small>
                </div>

                <label>
                  Additional fee (₱)
                  <input
                    type="number"
                    min="0"
                    max="99999.99"
                    step="0.01"
                    value={additionalFee}
                    onChange={(event) => {
                      setAdditionalFee(event.target.value);

                      if (Number(event.target.value) <= 0) {
                        setAdditionalFeeReason("");
                      }

                      setCashVerified(false);
                    }}
                  />
                </label>

                {fee > 0 && (
                  <POSReasonField
                    kind="fee"
                    value={additionalFeeReason}
                    onChange={(value) => {
                      setAdditionalFeeReason(value);
                      setCashVerified(false);
                    }}
                    disabled={submitting}
                  />
                )}

                {!validFee && (
                  <p className="pos-fee-fields__error">
                    Enter a valid fee and a reason (at least 5 characters), or
                    leave both empty/zero.
                  </p>
                )}
              </div>

              {fee > 0 && validFee && (
                <div className="sales-totals pos-fee-summary">
                  <span>Additional fee · {additionalFeeReason.trim()}</span>

                  <strong>{money(fee)}</strong>
                </div>
              )}

              <label>
                Payment timing
                <select
                  value={payLater ? "LATER" : "NOW"}
                  onChange={(event) => {
                    const later = event.target.value === "LATER";

                    setPayLater(later);

                    if (later) {
                      setPaymentCode("CASH");
                    }

                    setCashReceived("");
                    setCashVerified(false);
                  }}
                  disabled={submitting}
                >
                  <option value="NOW">Pay Now</option>

                  <option
                    value="LATER"
                    disabled={!paymentMethods.includes("CASH")}
                  >
                    Pay Later (cash)
                  </option>
                </select>
              </label>

              <label>
                Payment method
                <select
                  value={paymentCode}
                  disabled={payLater || submitting}
                  onChange={(event) => {
                    setPaymentCode(event.target.value);

                    setCashVerified(false);
                  }}
                >
                  {paymentMethods.map((code) => (
                    <option key={code} value={code}>
                      {code === "CASH"
                        ? "Cash"
                        : code === "GCASH"
                          ? "GCash via PayMongo"
                          : "QR Ph · bank app via PayMongo"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sales-totals sales-total">
                <span>Total {cashNow ? "to collect" : "due"}</span>

                <strong>{money(total)}</strong>
              </div>

              {cashNow && (
                <>
                  <label>
                    Cash received (₱)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={cashReceived}
                      onChange={(event) => {
                        setCashReceived(event.target.value);

                        setCashVerified(false);
                      }}
                    />
                  </label>

                  <div className="sales-totals">
                    <span>Change to return</span>

                    <strong>{money(change)}</strong>
                  </div>

                  <label className="sales-checkline">
                    <input
                      type="checkbox"
                      checked={cashVerified}
                      onChange={(event) =>
                        setCashVerified(event.target.checked)
                      }
                    />

                    <span>
                      I have physically received and counted the cash.
                    </span>
                  </label>
                </>
              )}

              <ActionGuidance
                title={
                  payLater
                    ? "Complete before saving unpaid sale"
                    : cashNow
                      ? "Complete before cash sale"
                      : "Complete before creating a PayMongo invoice"
                }
                reasons={checkoutReasons}
                readyText="Ready to complete the sale."
              />

              <button
                type="submit"
                className="sales-primary"
                disabled={!canSave}
              >
                <Wallet size={18} />

                {submitting
                  ? "Saving…"
                  : payLater
                    ? "Save unpaid sale"
                    : cashNow
                      ? "Complete cash sale"
                      : "Create pending PayMongo sale"}
              </button>

              <small className="sales-muted">
                {payLater
                  ? "Cash remains pending. Stock is reserved until dispatch or confirmed pickup."
                  : cashNow
                    ? "Pickup stock is deducted at handover; scheduled orders reserve stock until dispatch."
                    : "Online payments remain pending until PayMongo verifies payment."}
              </small>
            </form>
          </div>

          {receipt && (
            <POSResultModal
              kind="ORDER"
              record={receipt}
              canManage={canManage}
              onClose={() => setReceipt(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
