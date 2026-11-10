import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  BadgeCheck,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";

import api from "../../../api/api.js";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import POSWalkInService from "../../components/management/POSWalkInService.jsx";
import { getStaff } from "../../utils/authMock";

import "../../styles/management/sales-live.css";
import "../../styles/management/pos-enhancements.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

export default function POSPage() {
  const [catalog, setCatalog] = useState([]);
  const [cashAvailable, setCashAvailable] = useState(false);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [posTab, setPosTab] = useState("products");
  const [brand, setBrand] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [variantId, setVariantId] = useState("");

  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("0");
  const [cashReceived, setCashReceived] = useState("");
  const [cashVerified, setCashVerified] = useState(false);
  const [withInstallation, setWithInstallation] = useState(false);
  const [scheduledStart, setScheduledStart] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const requestKey = useRef(crypto.randomUUID());

  const staff = getStaff();

  const mayDiscount = ["OWNER", "MANAGER"].includes(staff?.role);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    api
      .get("/api/management/sales/catalog", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        setCatalog(data.items || []);
        setCashAvailable(Boolean(data.cashAvailable));
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err.response?.data?.message || "Could not load MySQL products.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      catalog.filter((p) =>
        `${p.brand} ${p.productName} ${p.model} ${p.horsepower}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [catalog, search],
  );

  const brands = useMemo(
    () =>
      [...new Set(filtered.map((p) => p.brand))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [filtered],
  );
  const models = useMemo(() => {
    const grouped = new Map();
    for (const item of filtered.filter((p) => p.brand === brand)) {
      const key = `${item.model}::${item.productName}`;
      if (!grouped.has(key))
        grouped.set(key, { key, label: `${item.model} · ${item.productName}` });
    }
    return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, brand]);
  const variants = useMemo(
    () =>
      filtered
        .filter(
          (p) =>
            p.brand === brand && `${p.model}::${p.productName}` === modelKey,
        )
        .sort((a, b) => Number(a.horsepower) - Number(b.horsepower)),
    [filtered, brand, modelKey],
  );
  const chosen = variants.find((p) => String(p.variantId) === variantId);

  const rows = useMemo(
    () =>
      cart
        .map((line) => ({
          ...line,
          product: catalog.find((p) => p.variantId === line.variantId),
        }))
        .filter((line) => line.product),
    [cart, catalog],
  );

  const subtotal =
    rows.reduce(
      (sum, line) => sum + Math.round(line.product.price * 100) * line.quantity,
      0,
    ) / 100;

  const reduction = Number(discount) || 0;

  const total = Math.max(0, Math.round((subtotal - reduction) * 100) / 100);

  const cash = Number(cashReceived) || 0;

  const change = Math.max(0, Math.round((cash - total) * 100) / 100);

  const canSave =
    !loading &&
    !submitting &&
    cashAvailable &&
    rows.length > 0 &&
    customerName.trim().length >= 2 &&
    reduction >= 0 &&
    reduction < subtotal &&
    (!reduction || mayDiscount) &&
    cash >= total &&
    cashVerified &&
    (!withInstallation ||
      (Boolean(scheduledStart) && serviceAddress.trim().length >= 5));

  function add(variant) {
    if (variant.available < 1 || submitting) return;

    setCart((old) => {
      const match = old.find((line) => line.variantId === variant.variantId);

      if (!match) {
        return [
          ...old,
          {
            variantId: variant.variantId,
            quantity: 1,
          },
        ];
      }

      return old.map((line) =>
        line.variantId === variant.variantId
          ? {
              ...line,
              quantity: Math.min(variant.available, 99, line.quantity + 1),
            }
          : line,
      );
    });

    setCashVerified(false);
  }

  function quantity(variantId, amount) {
    setCart((old) =>
      old
        .map((line) => {
          if (line.variantId !== variantId) {
            return line;
          }

          const stock =
            catalog.find((p) => p.variantId === variantId)?.available || 0;

          return {
            ...line,
            quantity: Math.max(0, Math.min(99, stock, line.quantity + amount)),
          };
        })
        .filter((line) => line.quantity > 0),
    );

    setCashVerified(false);
  }

  async function checkout(event) {
    event.preventDefault();

    if (!canSave) return;

    if (
      !window.confirm(
        `Confirm that ${money(cash)} cash was received for this ${money(total)} sale?`,
      )
    ) {
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
        cashReceived: Math.round(cash * 100) / 100,
        scheduledStart: withInstallation ? scheduledStart : null,
        serviceAddress: withInstallation ? serviceAddress.trim() : "",
        technicianIds: withInstallation && mayDiscount ? technicianIds : [],
      });

      if (!data.success || !data.receipt) {
        throw new Error("Sale was not confirmed.");
      }

      setReceipt(data.receipt);

      requestKey.current = crypto.randomUUID();

      setCart([]);
      setDiscount("0");
      setCashReceived("");
      setCashVerified(false);
      setCustomerName("Walk-in Customer");
      setCustomerPhone("");
      setWithInstallation(false);
      setScheduledStart("");
      setServiceAddress("");
      setTechnicianIds([]);

      setRefresh((n) => n + 1);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Cannot complete sale.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <nav className="pos-mode-switch" aria-label="POS sale type">
        <button
          type="button"
          className={posTab === "products" ? "is-selected" : ""}
          onClick={() => setPosTab("products")}
        >
          Product sale
        </button>
        <button
          type="button"
          className={posTab === "services" ? "is-selected" : ""}
          onClick={() => setPosTab("services")}
        >
          Walk-in service booking
        </button>
      </nav>
      {posTab === "services" ? (
        <POSWalkInService />
      ) : (
        <div className="sales-ui">
          <header className="sales-hero">
            <div>
              <span className="sales-kicker">
                <ShoppingCart size={16} />
                LIVE MYSQL POS
              </span>

              <h1>Walk-in sales</h1>

              <p>
                Sell in-stock air conditioners and record cash payments at the
                counter.
              </p>
            </div>

            <button
              type="button"
              className="sales-refresh"
              disabled={loading || submitting}
              onClick={() => setRefresh((n) => n + 1)}
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

          {!cashAvailable && !loading && (
            <p className="sales-error" role="status">
              No enabled CASH payment method. Run the included MySQL setup
              statement first.
            </p>
          )}

          <div className="sales-columns">
            <section className="sales-panel">
              <div className="sales-section-head">
                <h2>Products</h2>
                <span>{catalog.length} variants</span>
              </div>

              <label className="sales-search">
                <Search size={18} />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search brand, model, horsepower"
                  aria-label="Search products"
                />
              </label>

              {loading ? (
                <p className="sales-empty">Loading products from MySQL…</p>
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
                      {brands.map((b) => (
                        <option key={b} value={b}>
                          {b}
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
                      {models.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    3. Horsepower (HP)
                    <select
                      value={variantId}
                      disabled={!modelKey}
                      onChange={(event) => setVariantId(event.target.value)}
                    >
                      <option value="">Choose HP</option>
                      {variants.map((v) => (
                        <option key={v.variantId} value={v.variantId}>
                          {v.horsepower} HP · {money(v.price)} · {v.available}{" "}
                          left
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
                          {chosen.available > 0
                            ? `${chosen.available} in stock`
                            : "Out of stock"}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => add(chosen)}
                        disabled={
                          submitting ||
                          chosen.available <=
                            (cart.find(
                              (line) => line.variantId === chosen.variantId,
                            )?.quantity || 0)
                        }
                      >
                        <Plus size={16} /> Add to sale
                      </button>
                    </div>
                  )}
                  {brands.length === 0 && (
                    <p className="sales-empty">No matching products found.</p>
                  )}
                </div>
              )}

              <p className="sales-note">
                Choose Brand → Model → HP, then add the product. For cleaning,
                repair, or other walk-in services, switch to Walk-in service
                booking above.
              </p>
            </section>

            <form className="sales-panel sales-checkout" onSubmit={checkout}>
              <div className="sales-section-head">
                <h2>Current sale</h2>

                <span>{cart.reduce((n, i) => n + i.quantity, 0)} items</span>
              </div>

              <label>
                Customer name
                <input
                  value={customerName}
                  maxLength={150}
                  required
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>

              <label>
                Phone (optional)
                <input
                  value={customerPhone}
                  maxLength={30}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </label>

              {rows.length === 0 ? (
                <p className="sales-empty">
                  Add products from the left to begin.
                </p>
              ) : (
                <div className="sales-cart">
                  {rows.map(({ variantId, quantity: qty, product: p }) => (
                    <div className="sales-cart-line" key={variantId}>
                      <div>
                        <strong>{p.productName}</strong>

                        <small>
                          {p.horsepower} HP · {money(p.price)} each
                        </small>
                      </div>

                      <div className="sales-quantity">
                        <button
                          type="button"
                          onClick={() => quantity(variantId, -1)}
                          aria-label={`Remove one ${p.productName}`}
                        >
                          <Minus size={14} />
                        </button>

                        <b>{qty}</b>

                        <button
                          type="button"
                          onClick={() => quantity(variantId, 1)}
                          disabled={qty >= p.available}
                          aria-label={`Add one ${p.productName}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="sales-plain"
                        onClick={() => {
                          setCart((old) =>
                            old.filter((line) => line.variantId !== variantId),
                          );

                          setCashVerified(false);
                        }}
                        aria-label={`Remove ${p.productName} from cart`}
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
                  checked={withInstallation}
                  disabled={submitting}
                  onChange={(e) => {
                    setWithInstallation(e.target.checked);
                    setCashVerified(false);
                  }}
                />
                <span>
                  Book an installation appointment for this walk-in purchase
                </span>
              </label>
              {withInstallation && (
                <div style={{ display: "grid", gap: 10 }}>
                  <AvailabilityPicker
                    value={scheduledStart}
                    onChange={(value) => {
                      setScheduledStart(value);
                      setCashVerified(false);
                    }}
                    disabled={submitting}
                    label="Choose available installation time"
                  />
                  <label>
                    Installation address
                    <textarea
                      value={serviceAddress}
                      minLength={5}
                      maxLength={2000}
                      required
                      onChange={(event) =>
                        setServiceAddress(event.target.value)
                      }
                      placeholder="Customer's complete installation address"
                    />
                  </label>
                  {mayDiscount ? (
                    <TechnicianTeamPicker
                      value={technicianIds}
                      onChange={setTechnicianIds}
                      disabled={submitting}
                    />
                  ) : (
                    <p className="sales-checkline" role="note">
                      The appointment will be reserved now. An Owner or Manager
                      will assign the installation team from the saved Order
                      before work starts.
                    </p>
                  )}
                </div>
              )}

              <div className="sales-totals">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>

              {mayDiscount && (
                <label>
                  Discount (₱)
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={discount}
                    onChange={(e) => {
                      setDiscount(e.target.value);
                      setCashVerified(false);
                    }}
                  />
                </label>
              )}

              <div className="sales-totals sales-total">
                <span>Total to collect</span>
                <strong>{money(total)}</strong>
              </div>

              <label>
                Cash received (₱)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={cashReceived}
                  onChange={(e) => {
                    setCashReceived(e.target.value);
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
                  onChange={(e) => setCashVerified(e.target.checked)}
                />

                <span>I have physically received and counted the cash.</span>
              </label>

              <button
                type="submit"
                className="sales-primary"
                disabled={!canSave}
              >
                <Wallet size={18} />

                {submitting ? "Saving sale…" : "Complete cash sale"}
              </button>

              <small className="sales-muted">
                Stock is deducted and the payment is marked paid only after
                MySQL commits the sale.
              </small>
            </form>
          </div>

          {receipt && (
            <section className="sales-panel sales-receipt" role="status">
              <div className="sales-section-head">
                <h2>
                  <BadgeCheck size={21} />
                  Sale recorded
                </h2>

                <button
                  className="sales-refresh"
                  type="button"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  Print
                </button>
              </div>

              <p>
                <strong>Order:</strong> {receipt.orderNumber}
              </p>

              <p>
                <strong>Customer:</strong> {receipt.customer}
              </p>

              <p>
                <strong>Payment:</strong> PAID · CASH
              </p>

              {receipt.items?.map((item) => (
                <p key={item.variantId}>
                  {item.quantity} × {item.productName} · {money(item.lineTotal)}
                </p>
              ))}

              <div className="sales-totals sales-total">
                <span>Total paid</span>
                <strong>{money(receipt.total)}</strong>
              </div>

              {receipt.cashReceived && (
                <div className="sales-totals">
                  <span>Change</span>
                  <strong>{money(receipt.change)}</strong>
                </div>
              )}

              <Link to="/management/orders">View in Orders →</Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
