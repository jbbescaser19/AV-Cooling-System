import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, MinusCircle, X } from "lucide-react";

import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";

import "../../styles/management/inventory-removal.css";

const reasons = [
  {
    value: "DAMAGE",
    label: "Damaged or defective stock",
    type: "DAMAGE",
  },
  {
    value: "SUPPLIER",
    label: "Returned to supplier",
    type: "STOCK_OUT",
  },
  {
    value: "MISSING",
    label: "Missing stock",
    type: "STOCK_OUT",
  },
  {
    value: "CORRECTION",
    label: "Physical inventory correction",
    type: "STOCK_OUT",
  },
  {
    value: "INTERNAL",
    label: "Internal company use",
    type: "STOCK_OUT",
  },
  {
    value: "OTHER",
    label: "Other",
    type: "STOCK_OUT",
  },
];

function RemoveStockDialog({ variantId, onClose, onRemoved }) {
  const headingId = useId();
  const dialogRef = useRef(null);
  const submitLock = useRef(false);

  const [items, setItems] = useState([]);

  const [selectedId, setSelectedId] = useState(
    variantId == null ? "" : String(variantId),
  );

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState(null);
  const [uncertain, setUncertain] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    api
      .get("/api/management/workspace/inventory", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        if (!data.success || !Array.isArray(data.items)) {
          throw new Error("Invalid inventory response.");
        }

        setItems(data.items);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;

        setItems([]);

        setError(
          requestError.response?.data?.message ||
            "Unable to load current inventory.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [revision]);

  const selected = items.find((item) => String(item.id) === selectedId);

  const onHand = Number(selected?.onHand ?? 0);

  const reserved = Number(selected?.reserved ?? 0);

  const validStock =
    Number.isSafeInteger(onHand) &&
    Number.isSafeInteger(reserved) &&
    onHand >= reserved &&
    reserved >= 0;

  const available = validStock ? onHand - reserved : 0;

  const amount = Number(quantity);

  const maximum = Math.min(available, 100000);

  const selectedReason = reasons.find((item) => item.value === reason);

  const note =
    reason === "OTHER" ? customReason.trim() : selectedReason?.label || "";

  const quantityValid =
    Number.isSafeInteger(amount) && amount >= 1 && amount <= maximum;

  const reasonValid =
    Boolean(selectedReason) && note.length >= 5 && note.length <= 500;

  const canReview =
    Boolean(selected) &&
    validStock &&
    quantityValid &&
    reasonValid &&
    !loading &&
    !saving &&
    !uncertain;

  const afterOnHand = quantityValid ? onHand - amount : onHand;

  const afterAvailable = quantityValid ? available - amount : available;

  const needsRestock =
    Boolean(selected) &&
    quantityValid &&
    afterOnHand <= Number(selected.reorderLevel);

  function changeField(setter, value) {
    setter(value);
    setReview(null);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();

    if (!canReview || submitLock.current || uncertain) {
      return;
    }

    if (!review) {
      setReview({
        variantId: Number(selected.id),

        movementType: selectedReason.type,

        quantity: amount,

        note,

        expectedOnHand: onHand,

        expectedReserved: reserved,
      });

      setError("");
      return;
    }

    submitLock.current = true;

    setSaving(true);
    setError("");

    try {
      const { data } = await api.post(
        "/api/management/workspace/inventory",
        review,
      );

      if (!data.success) {
        throw new Error("The server did not confirm the stock removal.");
      }

      onRemoved?.(`${review.quantity} unit(s) removed from ${selected.name}.`);

      onClose();
    } catch (requestError) {
      const status = requestError.response?.status;

      if (!status || status >= 500) {
        setUncertain(true);

        setError(
          "The server could not confirm the result. Check Stock Movements before attempting another removal.",
        );

        return;
      }

      setError(
        requestError.response?.data?.message || "Unable to remove stock.",
      );

      setReview(null);

      if (status === 409) {
        setRevision((value) => value + 1);
      }
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="av-stock-removal wsm-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();

        if (!saving) onClose();
      }}
    >
      <header className="wsm-dialog-head">
        <div>
          <small>INVENTORY ADJUSTMENT</small>

          <h2 id={headingId}>Remove Stock</h2>
        </div>

        <button
          type="button"
          className="wsm-close"
          aria-label="Close stock removal"
          onClick={onClose}
          disabled={saving}
        >
          <X size={18} />
        </button>
      </header>

      <form className="wsm-form av-stock-removal__form" onSubmit={submit}>
        {error && (
          <div className="wsm-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading && <p role="status">Loading current stock…</p>}

        <fieldset
          className="av-stock-removal__fields"
          disabled={Boolean(review) || loading || saving || uncertain}
        >
          <label className="wsm-field">
            Product variant *
            <select
              required
              value={selectedId}
              disabled={variantId != null}
              onChange={(event) => {
                changeField(setSelectedId, event.target.value);

                setQuantity("1");
              }}
            >
              <option value="">Select aircon variant</option>

              {items.map((item) => {
                const stock = Number(item.onHand) - Number(item.reserved);

                return (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={stock <= 0 && String(item.id) !== selectedId}
                  >
                    {item.name} · {Math.max(0, stock)} available
                  </option>
                );
              })}
            </select>
          </label>

          {selected && (
            <div className="av-stock-removal__counts">
              <div>
                <span>On hand</span>
                <strong>{onHand}</strong>
              </div>

              <div>
                <span>Reserved</span>
                <strong>{reserved}</strong>
              </div>

              <div>
                <span>Available</span>
                <strong>{available}</strong>
              </div>
            </div>
          )}

          <label className="wsm-field">
            Quantity to remove *
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={Math.max(1, maximum)}
              step="1"
              required
              value={quantity}
              onChange={(event) => changeField(setQuantity, event.target.value)}
            />
            <small>
              Maximum removable: {maximum} unit(s). Reserved stock is protected.
            </small>
          </label>

          <label className="wsm-field">
            Reason for removal *
            <select
              required
              value={reason}
              onChange={(event) => {
                changeField(setReason, event.target.value);

                setCustomReason("");
              }}
            >
              <option value="">Select a reason</option>

              {reasons.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {reason === "OTHER" && (
            <label className="wsm-field">
              Specify reason *
              <textarea
                required
                rows={3}
                minLength={5}
                maxLength={500}
                value={customReason}
                placeholder="Enter the reason for removing stock."
                onChange={(event) =>
                  changeField(setCustomReason, event.target.value)
                }
              />
            </label>
          )}
        </fieldset>

        {selected && !quantityValid && !loading && (
          <p className="wsm-error" role="alert">
            {available === 0
              ? "There is no unreserved stock available to remove."
              : `Enter a whole number between 1 and ${maximum}.`}
          </p>
        )}

        {selected && quantityValid && (
          <section
            className="av-stock-removal__preview"
            aria-label="Stock after removal"
          >
            <h3>Stock adjustment summary</h3>

            <div>
              <span>Current on-hand stock</span>
              <strong>{onHand}</strong>
            </div>

            <div>
              <span>Stock to remove</span>

              <strong className="av-stock-removal__negative">−{amount}</strong>
            </div>

            <div>
              <span>Reserved stock</span>
              <strong>{reserved}</strong>
            </div>

            <div className="av-stock-removal__new-total">
              <span>New on-hand stock</span>

              <strong>{afterOnHand}</strong>
            </div>

            <div>
              <span>New available stock</span>

              <strong>{afterAvailable}</strong>
            </div>
          </section>
        )}

        {needsRestock && (
          <p className="av-stock-removal__warning">
            <AlertTriangle size={17} />
            This adjustment will leave stock at or below its reorder threshold.
          </p>
        )}

        {review && (
          <div className="av-stock-removal__confirmation" role="status">
            <strong>Confirm stock removal</strong>

            <p>
              Remove {review.quantity} unit(s) from {selected.name}?
            </p>

            <p>Reason: {review.note}</p>

            <small>
              This adjustment will be recorded under your staff account.
            </small>
          </div>
        )}

        <footer className="av-stock-removal__actions">
          <button
            type="button"
            className="wsm-secondary"
            disabled={saving}
            onClick={() => {
              if (review && !uncertain) {
                setReview(null);
              } else {
                onClose();
              }
            }}
          >
            {review && !uncertain ? "Back" : "Close"}
          </button>

          <button
            type="submit"
            className="av-stock-removal__danger"
            disabled={!canReview}
          >
            <MinusCircle size={16} />

            {saving
              ? "Removing…"
              : review
                ? "Confirm removal"
                : "Review removal"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default function InventoryRemoveStockButton({
  variantId = null,
  disabled = false,
  onRemoved,
  className = "",
}) {
  const [open, setOpen] = useState(false);

  const allowed = ["OWNER", "MANAGER"].includes(getStaff()?.role);

  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        className={`wsm-secondary av-stock-remove-trigger ${className}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <MinusCircle size={16} aria-hidden="true" />
        Remove Stock
      </button>

      {open && (
        <RemoveStockDialog
          variantId={variantId}
          onClose={() => setOpen(false)}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
}
