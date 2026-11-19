import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import {
  getCart,
  removeCartItem,
  updateCartItemQuantity,
  updateCartItemHorsepower,
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
  const [notice, setNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [reload, setReload] = useState(0);
  const [realtimeRevision, setRealtimeRevision] = useState(0);

  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(getSelectedCartKeys()),
  );

  const [quantityDrafts, setQuantityDrafts] = useState({});

  const hasLoadedRef = useRef(false);

  const mutationRevisionRef = useRef(0);
  const mutationInFlightRef = useRef(false);

  useRealtimeRefresh(["inventory", "catalog", "cart"], setRealtimeRevision);

  const {
    products,
    status: stockStatus,
    refresh: refreshStock,
  } = useStorefrontCatalog();

  const productMap = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products],
  );

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
    if (mutationInFlightRef.current) return;

    let active = true;

    const revisionAtRequest = mutationRevisionRef.current;

    const isCurrent = () =>
      active &&
      revisionAtRequest === mutationRevisionRef.current &&
      !mutationInFlightRef.current;

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
    const liveVariant = liveMap.get(`${item.productId}:${item.hp}`);

    const available = liveVariant?.stock;

    const product = productMap.get(String(item.productId));

    return {
      ...item,

      key: cartSelectionKey(item),

      available,

      variants: product?.variants || [],

      price:
        stockStatus === "ready" && Number.isFinite(liveVariant?.price)
          ? liveVariant.price
          : item.price,

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

  const hasUnsavedSelectedQuantity = selectedRows.some(
    (item) =>
      quantityDrafts[item.key] !== undefined &&
      String(quantityDrafts[item.key]) !== String(item.qty),
  );

  const selectionBlocked =
    stockStatus !== "ready" ||
    selectedRows.some((item) => item.blocked) ||
    selectedCount > 99 ||
    Boolean(syncError) ||
    hasUnsavedSelectedQuantity ||
    busy ||
    loading;

  const checkoutReady = selectedRows.length > 0 && !selectionBlocked;

  function updateSelection(next) {
    const values = new Set(next);

    setSelectedKeys(values);

    saveSelectedCartKeys([...values]);
  }

  function selectOne(item, checked) {
    if (busy || (checked && item.blocked)) {
      return;
    }

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

  function beginMutation() {
    if (mutationInFlightRef.current) {
      return false;
    }

    mutationInFlightRef.current = true;
    mutationRevisionRef.current += 1;

    setBusy(true);
    setError("");
    setNotice("");

    return true;
  }

  function endMutation() {
    mutationRevisionRef.current += 1;
    mutationInFlightRef.current = false;

    setBusy(false);
  }

  function clearQuantityDrafts(...keys) {
    setQuantityDrafts((previous) => {
      const copy = { ...previous };

      keys.forEach((key) => {
        delete copy[key];
      });

      return copy;
    });
  }

  function otherVariantQuantity(item, hp) {
    return rows.reduce((sum, row) => {
      if (row.productId !== item.productId || row.hp !== hp) {
        return sum;
      }

      if (
        row.key === item.key &&
        Boolean(row.pendingSync) === Boolean(item.pendingSync)
      ) {
        return sum;
      }

      return sum + Number(row.qty);
    }, 0);
  }

  function getVariantAvailability(item, variant) {
    const stock = Number.isInteger(variant.stock) ? variant.stock : 0;

    const otherQty = otherVariantQuantity(item, variant.hp);

    return Math.max(0, stock - otherQty);
  }

  async function remove(item) {
    if (busy || !beginMutation()) return;

    try {
      await removeCartItem(item, authenticated);

      setCart((current) =>
        current.filter(
          (row) =>
            !(
              cartSelectionKey(row) === item.key &&
              Boolean(row.pendingSync) === Boolean(item.pendingSync)
            ),
        ),
      );

      const next = new Set(selectedKeys);

      next.delete(item.key);

      updateSelection(next);

      clearQuantityDrafts(item.key);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not remove item.",
      );
    } finally {
      endMutation();
    }
  }

  async function changeQuantity(item, proposed) {
    if (busy || stockStatus !== "ready") {
      return;
    }

    const qty = Number(proposed);

    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      setError("Quantity must be a whole number between 1 and 99.");

      return;
    }

    if (qty === Number(item.qty)) {
      clearQuantityDrafts(item.key);
      return;
    }

    if (totalCartCount - Number(item.qty) + qty > 99) {
      setError("Your cart can hold at most 99 units in total.");

      return;
    }

    const available =
      Number(item.available || 0) - otherVariantQuantity(item, item.hp);

    if (qty > available) {
      setError(`Only ${Math.max(0, available)} units are available.`);

      return;
    }

    if (!beginMutation()) return;

    try {
      await updateCartItemQuantity(item, authenticated, qty, available);

      setCart((current) =>
        current.map((row) =>
          cartSelectionKey(row) === item.key &&
          Boolean(row.pendingSync) === Boolean(item.pendingSync)
            ? { ...row, qty }
            : row,
        ),
      );

      clearQuantityDrafts(item.key);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update quantity.",
      );
    } finally {
      endMutation();
    }
  }

  async function changeHorsepower(item, nextHp) {
    if (busy || stockStatus !== "ready" || nextHp === item.hp) {
      return;
    }

    const draft = quantityDrafts[item.key];

    if (draft !== undefined && String(draft) !== String(item.qty)) {
      setError("Save your quantity before changing horsepower.");

      return;
    }

    const product = productMap.get(String(item.productId));

    const variant = product?.variants?.find((option) => option.hp === nextHp);

    if (!variant) {
      setError("This horsepower is no longer available.");

      return;
    }

    const remainingStock = getVariantAvailability(item, variant);

    if (remainingStock < Number(item.qty)) {
      setError(
        `Not enough available stock for ${nextHp}. Reduce the quantity or choose another horsepower.`,
      );

      return;
    }

    const targetKey = cartSelectionKey({
      productId: item.productId,
      hp: nextHp,
    });

    const targetItems = rows.filter((row) => row.key === targetKey);

    const hasDifferentStorage = targetItems.some(
      (row) => Boolean(row.pendingSync) !== Boolean(item.pendingSync),
    );

    if (hasDifferentStorage) {
      setError("Retry cart sync before combining these items.");

      return;
    }

    const existingTarget = targetItems[0];

    const sourceSelected = selectedKeys.has(item.key);

    const targetSelected = selectedKeys.has(targetKey);

    if (!beginMutation()) return;

    try {
      const updatedItems = await updateCartItemHorsepower(
        item,
        authenticated,
        product,
        variant,
      );

      if (authenticated && !item.pendingSync) {
        setCart((current) => [
          ...updatedItems,
          ...current.filter((row) => row.pendingSync),
        ]);
      } else if (authenticated) {
        setCart((current) => [
          ...current.filter((row) => !row.pendingSync),

          ...updatedItems.map((row) => ({
            ...row,
            pendingSync: true,
          })),
        ]);
      } else {
        setCart(updatedItems);
      }

      const nextSelection = new Set(selectedKeys);

      nextSelection.delete(item.key);
      nextSelection.delete(targetKey);

      // Preserve selection when changing an item.
      // If a checked and unchecked item are combined,
      // require the customer to select the merged item again.
      if (existingTarget) {
        if (sourceSelected && targetSelected) {
          nextSelection.add(targetKey);
        }
      } else if (sourceSelected) {
        nextSelection.add(targetKey);
      }

      updateSelection(nextSelection);

      clearQuantityDrafts(item.key, targetKey);

      if (existingTarget) {
        setNotice(
          sourceSelected !== targetSelected
            ? `Changed to ${nextHp} and combined matching items. Please select the combined item again before checkout.`
            : `Changed to ${nextHp} and combined matching items.`,
        );
      } else {
        setNotice(`Horsepower updated to ${nextHp}.`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to change horsepower.",
      );

      refreshStock();
    } finally {
      endMutation();
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
              Check the products you want to buy now. You can change their
              horsepower and quantity. Unchecked products will stay in your
              cart.
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

        {notice && !error && (
          <p
            className="surface cart-message cart-message--success"
            role="status"
          >
            {notice}
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
              disabled={busy}
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

                    const hasQuantityDraft = String(draft) !== String(item.qty);

                    const availableForItem = Math.max(
                      0,
                      Number(item.available || 0) -
                        otherVariantQuantity(item, item.hp),
                    );

                    const canIncrease =
                      !busy &&
                      stockStatus === "ready" &&
                      Number(item.qty) < availableForItem &&
                      totalCartCount < 99;

                    const hasCurrentVariant = item.variants.some(
                      (variant) => variant.hp === item.hp,
                    );

                    return (
                      <article
                        key={
                          item.pendingSync ? `${item.key}-pending` : item.key
                        }
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
                            <label className="cart-edit-field cart-edit-hp">
                              <span>Horsepower</span>

                              <select
                                className="form-control"
                                aria-label={`Horsepower for ${item.name}`}
                                value={item.hp}
                                disabled={
                                  busy ||
                                  stockStatus !== "ready" ||
                                  item.variants.length === 0 ||
                                  hasQuantityDraft
                                }
                                onChange={(event) =>
                                  void changeHorsepower(
                                    item,
                                    event.target.value,
                                  )
                                }
                              >
                                {!hasCurrentVariant && (
                                  <option value={item.hp} disabled>
                                    {item.hp} — Unavailable
                                  </option>
                                )}

                                {item.variants.map((variant) => {
                                  const isCurrent = variant.hp === item.hp;

                                  const available = getVariantAvailability(
                                    item,
                                    variant,
                                  );

                                  const unavailable =
                                    available < Number(item.qty);

                                  return (
                                    <option
                                      key={variant.variantId ?? variant.hp}
                                      value={variant.hp}
                                      disabled={!isCurrent && unavailable}
                                    >
                                      {variant.hp}

                                      {variant.stock === 0
                                        ? " — Out of stock"
                                        : unavailable
                                          ? ` — ${available} left`
                                          : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>

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

                                    if (event.key === "Escape") {
                                      clearQuantityDrafts(item.key);
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

                          <p
                            className={`cart-edit-feedback${
                              stockStatus === "ready" &&
                              availableForItem < Number(item.qty)
                                ? " cart-edit-feedback--error"
                                : ""
                            }`}
                            role="status"
                          >
                            {stockStatus !== "ready"
                              ? "Checking stock…"
                              : availableForItem === 0
                                ? "Out of stock"
                                : availableForItem < Number(item.qty)
                                  ? `Only ${availableForItem} available`
                                  : `${availableForItem} units available`}
                          </p>

                          {hasQuantityDraft && (
                            <p className="cart-edit-feedback">
                              Save quantity before changing horsepower.
                            </p>
                          )}

                          <div className="cart-edit-footer">
                            <div className="cart-edit-pricing">
                              <span>{money(item.price)} per unit</span>

                              <strong>
                                {money(Number(item.price) * Number(item.qty))}
                              </strong>
                            </div>

                            {hasQuantityDraft && (
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
                              Not enough stock. Choose another horsepower,
                              reduce quantity, or leave this item unchecked.
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
                    One selected product is unavailable. Change its horsepower,
                    correct its quantity, or uncheck it.
                  </p>
                )}

                {hasUnsavedSelectedQuantity && (
                  <p className="cart-summary-warning">
                    Save your quantity changes before checkout.
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
