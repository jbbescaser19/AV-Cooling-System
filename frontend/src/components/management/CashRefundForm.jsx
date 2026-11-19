import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

export default function CashRefundForm({ kind, payment, onRefunded }) {
  const [reason, setReason] = useState("");
  const [returned, setReturned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const lock = useRef(false);

  async function submit(event) {
    event.preventDefault();

    if (lock.current || reference || !returned || reason.trim().length < 5) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");

    try {
      const approved = await confirmAction({
        title: kind === "ORDER" ? "Cancel & Refund" : "Record cash refund",

        message:
          `Confirm that ${money(payment.amount)} ` +
          "was already physically returned. " +
          "This records the refund, not a money transfer.",

        confirmText: "Record refund",
        danger: true,
      });

      if (!approved) return;

      const segment = kind === "ORDER" ? "payments" : "service-payments";

      const id = String(payment.id).replace(/^S/, "");

      const { data } = await api.post(
        `/api/management/sales/${segment}/${encodeURIComponent(id)}/confirm-refund`,
        {
          cashReturned: true,
          reason: reason.trim(),
        },
      );

      if (!data.success || !data.refundReference) {
        throw new Error("Refund confirmation was not returned.");
      }

      setReference(data.refundReference);
      setReturned(false);

      onRefunded?.(data);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not record refund.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <p className="sales-success" role="status">
        Refund recorded. Reference: <strong>{reference}</strong>. Do not return
        the money again.
      </p>
    );
  }

  return (
    <form
      className="service-payment-panel__refund-form wsm-form"
      onSubmit={submit}
    >
      <h3>{kind === "ORDER" ? "Cancel & Refund" : "Cash refund"}</h3>

      <p>
        Refund amount: <strong>{money(payment.amount)}</strong>
      </p>

      <p>
        Voucher reference is generated automatically. Only record funds that
        were already returned.
      </p>

      <label className="wsm-field">
        Refund reason
        <textarea
          required
          minLength={5}
          maxLength={500}
          rows={2}
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      <label className="av-cash-confirm-row">
        <input
          type="checkbox"
          checked={returned}
          disabled={busy}
          onChange={(e) => setReturned(e.target.checked)}
        />

        <span>I physically returned the full cash amount to the customer.</span>
      </label>

      {error && (
        <p className="sales-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="wsm-primary"
        disabled={busy || !returned || reason.trim().length < 5}
      >
        <ShieldCheck size={16} aria-hidden="true" />

        {busy
          ? "Recording…"
          : kind === "ORDER"
            ? "Cancel & Refund"
            : "Record refund"}
      </button>
    </form>
  );
}
