import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import {
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../utils/cartStore";

import {
  cartSelectionKey,
  getSelectedCartKeys,
  saveSelectedCartKeys,
} from "../../utils/cartSelection.js";

import { clearDirectCheckout } from "../../utils/purchaseFlow.js";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/cart.css";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [cart, setCart] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [reload, setReload] = useState(0);
  const [realtimeRevision, setRealtimeRevision] = useState(0);

  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(getSelectedCartKeys()),
  );

  const [quantityDrafts, setQuantityDrafts] = useState({});

  // Full loading should happen only on the first visit.
  const hasLoadedRef = useRef(false);

  // Prevent older requests from overwriting newer cart edits.
  const mutationRevisionRef = useRef(0);

  useRealtimeRefresh(["inventory", "catalog", "cart"], setRealtimeRevision);

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

    const revisionAtRequest = mutationRevisionRef.current;

    const isCurrent = () =>
      active && revisionAtRequest === mutationRevisionRef.current;

    // Do not hide product cards during background refresh.
    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    getCart()
      .then((result) => {
        if (!isCurrent()) return;

        setCart(Array.isArray(result.items) ? result.items : []);

        setAuthenticated(result.authenticated);
        setSyncError(result.syncError || "");
        setError("");
      })
      .catch((err) => {
        if (!isCurrent()) return;

        setError(err.response?.data?.message || "Unable to refresh your cart.");
      })
      .finally(() => {
        if (!isCurrent()) return;

        hasLoadedRef.current = true;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload, realtimeRevision]);

  const rows = cart.map((item) => {
    const available = liveMap.get(`${item.productId}:${item.hp}`)?.stock;

    return {
      ...item,
      key: cartSelectionKey(item),
      available,

      blocked:
        stockStatus !== "ready" ||
        !Number.isInteger(available) ||
        available < Number(item.qty),
    };
  });

  const eligibleRows = rows.filter((item) => !item.blocked);

  const eligibleKeys = eligibleRows.map((item) => item.key);

  const allSelected =
    eligibleKeys.length > 0 &&
    eligibleKeys.every((key) => selectedKeys.has(key));

  const selectedRows = rows.filter((item) => selectedKeys.has(item.key));

  const selectedCount = selectedRows.reduce(
    (sum, item) => sum + Number(item.qty),
    0,
  );

  const selectedTotal = selectedRows.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );

  const totalCartCount = rows.reduce((sum, item) => sum + Number(item.qty), 0);

  const selectionBlocked =
    stockStatus !== "ready" ||
    selectedRows.some((item) => item.blocked) ||
    selectedCount > 99 ||
    Boolean(syncError) ||
    busy ||
    loading;

  const checkoutReady = selectedRows.length > 0 && !selectionBlocked;

  function updateSelection(next) {
    const values = new Set(next);

    setSelectedKeys(values);
    saveSelectedCartKeys([...values]);
  }

  function selectOne(item, checked) {
    if (busy || (checked && item.blocked)) return;

    const next = new Set(selectedKeys);

    if (checked) {
      next.add(item.key);
    } else {
      next.delete(item.key);
    }

    updateSelection(next);
  }

  function selectAll() {
    if (busy) return;

    updateSelection(allSelected ? [] : eligibleKeys);
  }

  async function remove(item) {
    if (busy) return;

    setBusy(true);
    setError("");

    mutationRevisionRef.current += 1;

    try {
      await removeCartItem(item, authenticated);

      // Remove locally without reloading the entire cart.
      setCart((current) =>
        current.filter((row) => cartSelectionKey(row) !== item.key),
      );

      const next = new Set(selectedKeys);
      next.delete(item.key);

      updateSelection(next);

      setQuantityDrafts((previous) => {
        const copy = { ...previous };

        delete copy[item.key];

        return copy;
      });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not remove item.",
      );
    } finally {
      mutationRevisionRef.current += 1;
      setBusy(false);
    }
  }

  async function changeQuantity(item, proposed) {
    if (busy || stockStatus !== "ready") return;

    const qty = Number(proposed);

    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      setError("Quantity must be a whole number between 1 and 99.");
      return;
    }

    if (qty === Number(item.qty)) {
      setQuantityDrafts((previous) => {
        const copy = { ...previous };

        delete copy[item.key];

        return copy;
      });

      return;
    }

    setBusy(true);
    setError("");

    mutationRevisionRef.current += 1;

    try {
      // Backend still validates quantity and available stock.
      await updateCartItemQuantity(item, authenticated, qty, item.available);

      // Update the saved quantity locally.
      // No full-page loading screen or manual cart refetch.
      setCart((current) =>
        current.map((row) =>
          cartSelectionKey(row) === item.key ? { ...row, qty } : row,
        ),
      );

      setQuantityDrafts((previous) => {
        const copy = { ...previous };

        delete copy[item.key];

        return copy;
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update quantity.",
      );
    } finally {
      mutationRevisionRef.current += 1;
      setBusy(false);
    }
  }

  function goToCheckout() {
    if (!checkoutReady) return;

    saveSelectedCartKeys(selectedRows.map((item) => item.key));

    clearDirectCheckout();

    navigate("/checkout");
  }

  return (
    <section className="page-shell cart-page">
      <div className="container">
        <div className="page-intro cart-page-intro">
          <div>
            <div className="eyebrow">Shopping cart</div>

            <h1 className="page-title">Your cart</h1>

            <p className="section-copy">
              Check the products you want to buy now. Products you leave
              unchecked will stay in your cart after checkout.
            </p>
          </div>
        </div>

        {location.state?.cartWarning && (
          <p
            className="surface cart-message cart-message--warning"
            role="alert"
          >
            {location.state.cartWarning}
          </p>
        )}

        {loading && (
          <p className="surface cart-message" role="status">
            Loading cart…
          </p>
        )}

        {error && (
          <p className="surface cart-message cart-message--error" role="alert">
            {error}
          </p>
        )}

        {!loading && syncError && (
          <div
            className="surface cart-message cart-message--warning"
            role="alert"
          >
            <p>Cart sync: {syncError}</p>

            <button
              type="button"
              className="btn btn-soft cart-retry"
              onClick={() => {
                setReload((n) => n + 1);
                refreshStock();
              }}
            >
              Retry cart sync
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="surface empty-state cart-empty">
            <ShoppingBag size={36} aria-hidden="true" />

            <h2>Your cart is empty</h2>

            <p>
              Browse the available air conditioners and add the ones you need.
            </p>

            <Link className="btn btn-dark" to="/shop">
              Browse Products
            </Link>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="cart-layout">
              <div className="cart-items-column">
                <div className="cart-select-bar">
                  <label className="cart-select-all">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={busy || eligibleKeys.length === 0}
                      onChange={selectAll}
                    />

                    <span>Select all available</span>
                  </label>

                  <span className="cart-selected-count">
                    {selectedRows.length} of {rows.length} products selected
                  </span>
                </div>

                <div className="cart-list">
                  {rows.map((item) => {
                    const selected = selectedKeys.has(item.key);

                    const draft = quantityDrafts[item.key] ?? String(item.qty);

                    const canIncrease =
                      !busy &&
                      stockStatus === "ready" &&
                      Number(item.qty) < Number(item.available) &&
                      totalCartCount < 99;

                    return (
                      <article
                        key={item.key}
                        className={`surface cart-item cart-edit-item${
                          selected ? " cart-edit-item--selected" : ""
                        }`}
                      >
                        <div className="cart-edit-heading">
                          <label className="cart-item-choice">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={busy || (item.blocked && !selected)}
                              onChange={(event) =>
                                selectOne(item, event.target.checked)
                              }
                              aria-label={`Select ${item.name}, ${item.hp} for checkout`}
                            />
                          </label>

                          <div className="cart-edit-product">
                            <b>{item.name}</b>

                            <span>
                              {item.brand ? `${item.brand} · ` : ""}
                              {item.hp}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="cart-edit-remove"
                            onClick={() => remove(item)}
                            disabled={busy}
                            aria-label={`Remove ${item.name} from cart`}
                            title="Remove product"
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="cart-edit-form">
                          <div className="cart-edit-controls">
                            <div className="cart-edit-field cart-edit-hp">
                              <span>Availability</span>

                              <div className="form-control" aria-live="polite">
                                {stockStatus !== "ready"
                                  ? "Checking stock…"
                                  : !Number.isInteger(item.available) ||
                                      item.available === 0
                                    ? "Out of stock"
                                    : item.available < Number(item.qty)
                                      ? `Only ${item.available} available`
                                      : `${item.available} available`}
                              </div>
                            </div>

                            <div className="cart-edit-field">
                              <span>Quantity</span>

                              <div className="cart-edit-stepper">
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity of ${item.name}`}
                                  disabled={
                                    busy ||
                                    item.qty <= 1 ||
                                    stockStatus !== "ready"
                                  }
                                  onClick={() =>
                                    changeQuantity(item, Number(item.qty) - 1)
                                  }
                                >
                                  <Minus size={15} />
                                </button>

                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  step="1"
                                  inputMode="numeric"
                                  aria-label={`Quantity for ${item.name}`}
                                  value={draft}
                                  disabled={busy || stockStatus !== "ready"}
                                  onChange={(event) =>
                                    setQuantityDrafts((previous) => ({
                                      ...previous,
                                      [item.key]: event.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();

                                      void changeQuantity(item, draft);
                                    }
                                  }}
                                />

                                <button
                                  type="button"
                                  aria-label={`Increase quantity of ${item.name}`}
                                  disabled={!canIncrease}
                                  onClick={() =>
                                    changeQuantity(item, Number(item.qty) + 1)
                                  }
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="cart-edit-footer">
                            <div className="cart-edit-pricing">
                              <span>{money(item.price)} per unit</span>

                              <strong>
                                {money(Number(item.price) * Number(item.qty))}
                              </strong>
                            </div>

                            {String(draft) !== String(item.qty) && (
                              <button
                                type="button"
                                className="cart-edit-save"
                                disabled={busy || stockStatus !== "ready"}
                                onClick={() => changeQuantity(item, draft)}
                              >
                                Save quantity
                              </button>
                            )}
                          </div>

                          {item.blocked && stockStatus === "ready" && (
                            <p className="cart-edit-feedback cart-edit-feedback--error">
                              Not enough stock. Reduce quantity or leave this
                              item unchecked.
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="surface cart-summary cart-order-summary">
                <h2>Selected items summary</h2>

                <div className="cart-summary-row">
                  <span>Selected products</span>

                  <strong>{selectedRows.length}</strong>
                </div>

                <div className="cart-summary-row">
                  <span>Selected units</span>

                  <strong>{selectedCount}</strong>
                </div>

                <div className="cart-summary-row cart-total">
                  <span>Subtotal</span>

                  <strong>{money(selectedTotal)}</strong>
                </div>

                <p className="cart-selection-note">
                  Only checked products go to checkout. Delivery is calculated
                  there. Unchecked products stay saved in your cart.
                </p>

                {selectedRows.length === 0 && (
                  <p className="cart-summary-warning">
                    Select at least one product to continue.
                  </p>
                )}

                {selectedRows.some((item) => item.blocked) && (
                  <p className="cart-summary-warning">
                    One selected product is unavailable. Uncheck it or correct
                    its quantity.
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn-dark cart-checkout"
                  disabled={!checkoutReady}
                  onClick={goToCheckout}
                >
                  {busy
                    ? "Updating cart…"
                    : `Checkout ${selectedRows.length} selected product${
                        selectedRows.length === 1 ? "" : "s"
                      }`}
                </button>
              </aside>
            </div>

            <div className="cart-bottom-actions">
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
