import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  getCart,
  MAX_CART_QUANTITY,
  removeCartItem,
  updateCartItem,
} from "../../utils/cartStore";
import { readCatalogProducts } from "../../utils/catalogStore";
import { clearDirectCheckout } from "../../utils/purchaseFlow";
import {
  cartItemKey,
  readCheckoutSelection,
  saveCheckoutSelection,
} from "../../utils/checkoutSelection";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/cart.css";

const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

function CartLine({
  item,
  checked,
  onSelect,
  totalUnits,
  busy,
  onSave,
  onRemove,
  existingHPs,
  catalog,
}) {
  const [hp, setHp] = useState(item.hp);
  const [qtyInput, setQtyInput] = useState(String(item.qty));

  useEffect(() => {
    setHp(item.hp);
    setQtyInput(String(item.qty));
  }, [item.hp, item.qty]);

  const product = catalog.find((entry) => entry.id === item.productId);
  const variants = item.options?.length
    ? item.options
    : product?.variants || [];
  const options = variants.some((variant) => variant.hp === item.hp)
    ? variants
    : [{ hp: item.hp, price: item.price }, ...variants];
  const selectedVariant = options.find((variant) => variant.hp === hp);

  const quantity = qtyInput.trim() === "" ? NaN : Number(qtyInput);
  const validQty =
    Number.isSafeInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_CART_QUANTITY;
  const overLimit =
    validQty && totalUnits - Number(item.qty) + quantity > MAX_CART_QUANTITY;
  const changed = hp !== item.hp || quantity !== Number(item.qty);
  const canSave = changed && validQty && !overLimit && !busy;
  const price = Number(selectedVariant?.price ?? item.price);
  const previewTotal = price * (validQty ? quantity : Number(item.qty));
  const mergesWithExisting = hp !== item.hp && existingHPs.includes(hp);
  const itemId = `${item.productId}-${item.hp}`;

  function adjust(delta) {
    const current = Number(qtyInput);
    const start =
      Number.isSafeInteger(current) && current > 0 ? current : Number(item.qty);
    const remaining = Math.max(
      1,
      MAX_CART_QUANTITY - (totalUnits - Number(item.qty)),
    );
    setQtyInput(String(Math.max(1, Math.min(remaining, start + delta))));
  }

  async function save(event) {
    event.preventDefault();
    if (canSave) await onSave(item, hp, quantity);
  }

  return (
    <article
      className={`surface cart-item cart-edit-item${checked ? " cart-edit-item--selected" : ""}`}
    >
      <div className="cart-edit-heading">
        <label className="cart-item-choice" title="Include in checkout">
          <input
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(event) => onSelect(item, event.target.checked)}
            aria-label={`Select ${item.name}, ${item.hp}, for checkout`}
          />
        </label>
        <div className="cart-edit-product">
          <b>{item.name}</b>
          <span>{item.brand || "Air conditioner"}</span>
        </div>
        <button
          type="button"
          className="cart-edit-remove"
          onClick={() => onRemove(item)}
          disabled={busy}
          aria-label={`Remove ${item.name} ${item.hp} from cart`}
          title="Remove item"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      <form className="cart-edit-form" onSubmit={save}>
        <div className="cart-edit-controls">
          <label
            className="cart-edit-field cart-edit-hp"
            htmlFor={`cart-hp-${itemId}`}
          >
            <span>Horsepower</span>
            <select
              id={`cart-hp-${itemId}`}
              className="form-control"
              value={hp}
              onChange={(event) => setHp(event.target.value)}
              disabled={busy}
            >
              {options.map((variant) => (
                <option key={variant.hp} value={variant.hp}>
                  {variant.hp}
                </option>
              ))}
            </select>
          </label>
          <div className="cart-edit-field cart-edit-qty">
            <span id={`cart-qty-label-${itemId}`}>Quantity</span>
            <div
              className="cart-edit-stepper"
              role="group"
              aria-labelledby={`cart-qty-label-${itemId}`}
            >
              <button
                type="button"
                disabled={busy || (validQty && quantity <= 1)}
                onClick={() => adjust(-1)}
                aria-label={`Decrease ${item.name} quantity`}
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={MAX_CART_QUANTITY}
                step="1"
                value={qtyInput}
                onChange={(event) => setQtyInput(event.target.value)}
                disabled={busy}
                aria-label={`Quantity for ${item.name} ${item.hp}`}
              />
              <button
                type="button"
                disabled={
                  busy ||
                  (validQty &&
                    totalUnits - Number(item.qty) + quantity >=
                      MAX_CART_QUANTITY)
                }
                onClick={() => adjust(1)}
                aria-label={`Increase ${item.name} quantity`}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="cart-edit-footer">
          <div className="cart-edit-pricing">
            <span>{money(price)} / unit</span>
            <strong>{money(previewTotal)}</strong>
          </div>
          <button className="cart-edit-save" type="submit" disabled={!canSave}>
            <Check size={15} aria-hidden="true" />
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {!validQty && (
          <p
            className="cart-edit-feedback cart-edit-feedback--error"
            role="alert"
          >
            Enter a whole quantity from 1 to {MAX_CART_QUANTITY}.
          </p>
        )}
        {overLimit && (
          <p
            className="cart-edit-feedback cart-edit-feedback--error"
            role="alert"
          >
            Your cart limit is {MAX_CART_QUANTITY} total units.
          </p>
        )}
        {mergesWithExisting && changed && validQty && !overLimit && (
          <p className="cart-edit-feedback">
            Saving will combine this with your existing {hp} item.
          </p>
        )}
      </form>
    </article>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const selectAllRef = useRef(null);
  const [cart, setCart] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const catalog = useMemo(() => readCatalogProducts(), []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getCart();
        if (!alive) return;
        setCart(result.items);
        setAuthenticated(result.authenticated);
        setSyncError(result.syncError || "");
        const previouslySelected = readCheckoutSelection();
        const keys = result.items.map(cartItemKey);
        setSelectedKeys(
          previouslySelected === null
            ? keys
            : keys.filter((key) => previouslySelected.includes(key)),
        );
      } catch (requestError) {
        if (alive)
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load cart.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!loading) {
      try {
        saveCheckoutSelection(selectedKeys);
      } catch {
        /* Checkout button reports storage errors. */
      }
    }
  }, [selectedKeys, loading]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedItems = cart.filter((item) =>
    selectedSet.has(cartItemKey(item)),
  );
  const totalUnits = cart.reduce((sum, item) => sum + Number(item.qty), 0);
  const selectedUnits = selectedItems.reduce(
    (sum, item) => sum + Number(item.qty),
    0,
  );
  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );
  const allSelected = cart.length > 0 && selectedItems.length === cart.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedItems.length > 0 && !allSelected;
    }
  }, [allSelected, selectedItems.length]);

  function selectOne(item, selected) {
    const key = cartItemKey(item);
    setSelectedKeys((old) =>
      selected
        ? [...new Set([...old, key])]
        : old.filter((value) => value !== key),
    );
  }

  function toggleAll(checked) {
    setSelectedKeys(checked ? cart.map(cartItemKey) : []);
  }

  async function saveItem(item, hp, qty) {
    if (busyKey) return;
    setBusyKey(cartItemKey(item));
    setError("");
    setNotice("");
    try {
      const items = await updateCartItem(item, hp, qty, authenticated);
      const oldKey = cartItemKey(item);
      const newKey = cartItemKey({ ...item, hp });
      setSelectedKeys((old) => {
        const wasSelected = old.includes(oldKey);
        const next = old.filter((key) => key !== oldKey);
        return wasSelected ? [...new Set([...next, newKey])] : next;
      });
      setCart(items);
      setNotice("Cart updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update item.",
      );
    } finally {
      setBusyKey("");
    }
  }

  async function removeItem(item) {
    if (busyKey) return;
    setBusyKey(cartItemKey(item));
    setError("");
    setNotice("");
    try {
      await removeCartItem(item, authenticated);
      setSelectedKeys((old) => old.filter((key) => key !== cartItemKey(item)));
      setRetry((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to remove item.",
      );
    } finally {
      setBusyKey("");
    }
  }

  function checkoutSelected() {
    if (loading || busyKey || syncError || selectedItems.length === 0) return;
    setError("");
    try {
      saveCheckoutSelection(selectedItems.map(cartItemKey));
      clearDirectCheckout();
      navigate("/checkout");
    } catch {
      setError(
        "Unable to prepare checkout. Please enable browser session storage.",
      );
    }
  }

  return (
    <section className="page-shell cart-page">
      <div className="container">
        <div className="page-intro cart-page-intro">
          <div>
            <div className="eyebrow">Shopping cart</div>
            <h1 className="page-title">Your cart</h1>
            <p className="section-copy">
              Choose what to buy now. Unselected items stay saved for later.
            </p>
          </div>
        </div>

        {loading && (
          <p className="surface cart-message" role="status">
            Loading your cart…
          </p>
        )}
        {error && (
          <p className="surface cart-message cart-message--error" role="alert">
            {error}
          </p>
        )}
        {!loading && error && !cart.length && (
          <button
            className="btn btn-soft cart-retry"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        )}
        {notice && (
          <p className="cart-message cart-message--success" role="status">
            {notice}
          </p>
        )}
        {!loading && syncError && (
          <div
            className="surface cart-message cart-message--warning"
            role="alert"
          >
            <strong>Guest cart not synced yet</strong>
            <p>{syncError}</p>
            <p>
              Items remain saved in this browser. Edit or remove some, then
              retry.
            </p>
            <button
              className="btn btn-soft cart-retry"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry sync
            </button>
          </div>
        )}

        {!loading && !error && cart.length === 0 && (
          <div className="surface empty-state cart-empty">
            <ShoppingBag size={32} aria-hidden="true" />
            <h2>Your cart is empty</h2>
            <p>
              Choose an air conditioner and the horsepower that fits your space.
            </p>
            <Link className="btn btn-dark" to="/shop">
              Browse products
            </Link>
          </div>
        )}

        {!loading && cart.length > 0 && (
          <>
            <div className="cart-layout">
              <div className="cart-items-column">
                <div className="cart-select-bar">
                  <label className="cart-select-all">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      disabled={Boolean(busyKey)}
                      onChange={(event) => toggleAll(event.target.checked)}
                    />
                    <span>Select all</span>
                  </label>
                  <span className="cart-selected-count">
                    {selectedItems.length} of {cart.length} selected
                  </span>
                </div>
                <div className="cart-list" aria-label="Cart items">
                  {cart.map((item) => (
                    <CartLine
                      key={cartItemKey(item)}
                      item={item}
                      checked={selectedSet.has(cartItemKey(item))}
                      onSelect={selectOne}
                      totalUnits={totalUnits}
                      busy={Boolean(busyKey)}
                      existingHPs={cart
                        .filter(
                          (other) =>
                            other.productId === item.productId &&
                            other.hp !== item.hp,
                        )
                        .map((other) => other.hp)}
                      catalog={catalog}
                      onSave={saveItem}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </div>

              <aside className="surface cart-summary cart-order-summary">
                <h2>Checkout summary</h2>
                <div className="cart-summary-row">
                  <span>Selected products</span>
                  <strong>{selectedItems.length}</strong>
                </div>
                <div className="cart-summary-row">
                  <span>Selected units</span>
                  <strong>{selectedUnits}</strong>
                </div>
                <div className="cart-summary-row">
                  <span>Cart limit</span>
                  <strong>
                    {totalUnits} / {MAX_CART_QUANTITY}
                  </strong>
                </div>
                <div className="cart-summary-row cart-total">
                  <span>Selected subtotal</span>
                  <strong>{money(selectedTotal)}</strong>
                </div>
                <p className="cart-selection-note">
                  Unselected items remain in your cart.
                </p>
                <button
                  type="button"
                  className="btn btn-dark cart-checkout"
                  disabled={
                    Boolean(busyKey) ||
                    Boolean(syncError) ||
                    selectedItems.length === 0
                  }
                  onClick={checkoutSelected}
                >
                  Checkout selected ({selectedItems.length})
                </button>
                {selectedItems.length === 0 && (
                  <p className="cart-selection-note">
                    Select an item to continue.
                  </p>
                )}
                {syncError && (
                  <p className="cart-summary-warning">
                    Resolve cart sync before checkout.
                  </p>
                )}
              </aside>
            </div>
            <div className="cart-actions cart-bottom-actions">
              <Link className="btn btn-soft" to="/shop">
                Continue shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
