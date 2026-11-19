import { useEffect, useRef, useState } from "react";

import POSReasonField from "./POSReasonField.jsx";

import api from "../../../api/api.js";

import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import "../../styles/management/workspace.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const cents = (value) => Math.round(Number(value) * 100);

const validMoney = (value) => /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value);

export default function PriceAdjustmentPanel({
  kind,
  recordId,
  refreshKey = 0,
  onUpdated,
}) {
  const [pricing, setPricing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  const saveLock = useRef(false);
  const savedGeneration = useRef(0);

  const endpoint = `/api/management/${
    kind === "ORDER" ? "orders" : "services"
  }/${encodeURIComponent(recordId)}/price-adjustment`;

  useRealtimeRefresh(
    [kind === "ORDER" ? "orders" : "services", "payments"],
    setRevision,
  );

  useEffect(() => {
    if (!recordId) return;

    const controller = new AbortController();

    const generation = savedGeneration.current;

    api
      .get(endpoint, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (
          !controller.signal.aborted &&
          generation === savedGeneration.current
        ) {
          setPricing(data.pricing);
          setLoadError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (
          !controller.signal.aborted &&
          generation === savedGeneration.current
        ) {
          setPricing(null);

          setLoadError(
            err.response?.data?.message || "Unable to load pricing.",
          );

          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [endpoint, recordId, refreshKey, revision]);

  function edit() {
    if (!pricing?.editable) return;

    setError("");
    setNotice("");

    setDraft({
      discount: pricing.discount,

      discountReason: pricing.discountReason || "",

      additionalFee: pricing.additionalFee,

      additionalFeeReason: pricing.additionalFeeReason,

      expectedVersion: pricing.version,

      customerAgreed: false,
    });
  }

  function change(key, value) {
    setDraft((previous) => ({
      ...previous,

      [key]: value,

      customerAgreed: false,
    }));
  }

  const stale = Boolean(draft && pricing?.version !== draft.expectedVersion);

  const discount = cents(draft?.discount ?? 0);

  const fee = cents(draft?.additionalFee ?? 0);

  const base = cents(pricing?.base ?? 0);

  const preview = base + cents(pricing?.deliveryFee ?? 0) - discount + fee;

  const valid =
    draft &&
    pricing?.editable &&
    !stale &&
    validMoney(draft.discount) &&
    validMoney(draft.additionalFee) &&
    discount <= 999999900 &&
    fee <= 9999999 &&
    (discount === 0 || discount < base) &&
    (discount > 0
      ? draft.discountReason.trim().length >= 5
      : !draft.discountReason.trim()) &&
    preview > 0 &&
    preview <= 999999999999 &&
    (fee > 0
      ? draft.additionalFeeReason.trim().length >= 5
      : !draft.additionalFeeReason.trim()) &&
    draft.customerAgreed;

  async function save(event) {
    event.preventDefault();

    if (!valid || saveLock.current) return;

    saveLock.current = true;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.patch(endpoint, {
        ...draft,

        additionalFeeReason: draft.additionalFeeReason.trim(),

        discountReason: draft.discountReason.trim(),
      });

      savedGeneration.current += 1;

      setPricing(data.pricing);

      setDraft(null);

      setNotice(data.message || "Price updated.");

      onUpdated?.();

      window.dispatchEvent(new Event("av-management-updated"));

      setRevision((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save pricing.");

      if (err.response?.status === 409) {
        setRevision((value) => value + 1);
      }
    } finally {
      saveLock.current = false;

      setSaving(false);
    }
  }

  if (!recordId) return null;

  return (
    <section className="sales-step" aria-label="Price adjustments">
      <h3>Price adjustments</h3>

      {loading && <p role="status">Loading pricing…</p>}

      {pricing && (
        <>
          <div className="sales-totals">
            <span>{kind === "ORDER" ? "Subtotal" : "Base service price"}</span>

            <strong>{money(pricing.base)}</strong>
          </div>

          {kind === "ORDER" && (
            <div className="sales-totals">
              <span>Delivery fee</span>

              <strong>{money(pricing.deliveryFee)}</strong>
            </div>
          )}

          <div className="sales-totals">
            <span>Additional fee</span>

            <strong>{money(pricing.additionalFee)}</strong>
          </div>

          {pricing.additionalFeeReason && (
            <small>Fee reason: {pricing.additionalFeeReason}</small>
          )}

          <div className="sales-totals">
            <span>Discount</span>

            <strong>−{money(pricing.discount)}</strong>
          </div>

          {Number(pricing.discount) > 0 && (
            <small>
              Discount reason: {pricing.discountReason || "Not recorded"}
            </small>
          )}

          <div className="sales-totals sales-total">
            <strong>Saved total</strong>

            <strong>{money(pricing.total)}</strong>
          </div>

          {!pricing.editable && (
            <p className="sales-note">{pricing.blockedReason}</p>
          )}

          {pricing.editable && !draft && (
            <div>
              <button type="button" className="wsm-secondary" onClick={edit}>
                Edit fee / discount
              </button>
            </div>
          )}
        </>
      )}

      {draft && (
        <form className="wsm-form" onSubmit={save}>
          {stale && (
            <p role="alert" className="sales-error">
              This record changed. Cancel editing and reopen the current prices.
            </p>
          )}

          <label className="wsm-field">
            Additional fee (₱)
            <input
              type="number"
              min="0"
              max="99999.99"
              step="0.01"
              value={draft.additionalFee}
              disabled={saving || stale}
              required
              onChange={(event) => {
                change("additionalFee", event.target.value);

                if (Number(event.target.value) <= 0) {
                  change("additionalFeeReason", "");
                }
              }}
            />
          </label>

          {fee > 0 && (
            <POSReasonField
              kind="fee"
              value={draft.additionalFeeReason}
              disabled={saving || stale}
              onChange={(value) => change("additionalFeeReason", value)}
            />
          )}

          <label className="wsm-field">
            Discount (₱)
            <input
              type="number"
              min="0"
              max="9999999"
              step="0.01"
              value={draft.discount}
              disabled={saving || stale}
              required
              onChange={(event) => {
                change("discount", event.target.value);

                if (Number(event.target.value) <= 0) {
                  change("discountReason", "");
                }
              }}
            />
          </label>

          {discount > 0 && (
            <POSReasonField
              kind="discount"
              value={draft.discountReason}
              disabled={saving || stale}
              onChange={(value) => change("discountReason", value)}
            />
          )}

          <div className="sales-totals sales-total">
            <strong>New total</strong>

            <strong>
              {Number.isFinite(preview) && preview > 0
                ? money(preview / 100)
                : "—"}
            </strong>
          </div>

          <p className="sales-note">
            Enter the final fee and discount agreed with the customer. Save
            before confirming the order or service. No payment is collected
            here.
          </p>

          <label className="av-cash-confirm-row">
            <input
              type="checkbox"
              checked={draft.customerAgreed}
              disabled={saving || stale}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,

                  customerAgreed: event.target.checked,
                }))
              }
            />
            I confirmed the revised total with the customer.
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <button
              type="submit"
              className="wsm-primary"
              disabled={!valid || saving}
            >
              {saving ? "Saving…" : "Save adjustments"}
            </button>

            <button
              type="button"
              className="wsm-secondary"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              Cancel editing
            </button>
          </div>
        </form>
      )}

      {loadError && (
        <p role="alert" className="sales-error">
          {loadError}
        </p>
      )}

      {error && (
        <p role="alert" className="sales-error">
          {error}
        </p>
      )}

      {!pricing && !loading && (
        <div>
          <button
            type="button"
            className="wsm-secondary"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              setRevision((value) => value + 1);
            }}
          >
            Retry pricing
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="sales-success">
          {notice}
        </p>
      )}
    </section>
  );
}
