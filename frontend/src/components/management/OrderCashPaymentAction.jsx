import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

/**
 * Optional manual cash verification from Order Details.
 * Uses the same endpoint as Management -> Payments.
 * No payment is ever marked paid just because an order was confirmed.
 */
export default function OrderCashPaymentAction({ order, onConfirmed }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collected, setCollected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  const orderNumber = order?.orderNumber;
  const pending = order?.paymentStatus === "PENDING";
  const eligibleStatus = [
    "CONFIRMED",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
  ].includes(order?.status);

  useEffect(() => {
    setCollected(false);
    setNotice("");
    setError("");
    setPayment(null);
    if (!orderNumber || !pending || !eligibleStatus) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/management/sales/payments", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const found = (data.payments || []).find(
          (entry) =>
            entry.orderNumber === orderNumber &&
            entry.status === "PENDING" &&
            entry.method === "CASH" &&
            ["ONLINE", "FACEBOOK"].includes(entry.channel),
        );
        setPayment(found || null);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Unable to check the cash payment record.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderNumber, pending, eligibleStatus, revision]);

  if (!orderNumber || !pending || !eligibleStatus) return null;

  async function confirmCash(event) {
    event.preventDefault();
    if (!payment || !collected || busy) return;

    const approved = await confirmAction({
      title: "Confirm cash collection",
      message: `Confirm that you physically received ${money(payment.amount)} for order ${orderNumber}. This will record the payment as PAID.`,
      confirmText: "Record as PAID",
    });
    if (!approved) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        `/api/management/sales/payments/${payment.id}/confirm-cash`,
        {
          cashCollected: true,
          note: "Cash physically received and verified by management.",
        },
      );
      if (!data.success) throw new Error("Payment was not confirmed.");
      setCollected(false);
      setPayment(null);
      setNotice("Cash received and recorded as PAID.");
      onConfirmed?.();
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Cash payment confirmation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sales-step" aria-label="Optional cash confirmation">
      <h3>Confirm cash payment (optional)</h3>
      <p className="sales-note">
        Confirm here only after physically receiving the cash. You can also
        confirm it from <Link to="/management/payments">Payments</Link>.
        Starting work does not automatically mark the payment as paid.
      </p>
      {loading ? (
        <p role="status">Checking cash payment…</p>
      ) : payment ? (
        <form onSubmit={confirmCash}>
          <label className="av-cash-confirm-row">
            <input
              type="checkbox"
              checked={collected}
              onChange={(event) => setCollected(event.target.checked)}
              disabled={busy}
            />{" "}
            I physically received and counted {money(payment.amount)} in cash.
          </label>
          <button
            className="sales-primary"
            type="submit"
            disabled={busy || !collected}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {busy ? "Saving…" : "Confirm Cash"}
          </button>
        </form>
      ) : !notice && !error ? (
        <p className="sales-note">
          No eligible pending cash payment was found here. Check the Payments
          page for the complete payment record.
        </p>
      ) : null}
      {error && (
        <p className="sales-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sales-success" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
