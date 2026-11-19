import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";

import { confirmAction } from "../../utils/confirmAction.jsx";

import CashRefundForm from "./CashRefundForm.jsx";
import PriceAdjustmentPanel from "./PriceAdjustmentPanel.jsx";
import OrderReschedulePanel from "./OrderReschedulePanel.jsx";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

export default function OrderCashPaymentAction({ order, onConfirmed }) {
  const [collected, setCollected] = useState(false);
  const [released, setReleased] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lock = useRef(false);

  const payment = order?.payment;

  const pickup = order?.channel === "POS" && order?.fulfillment === "PICKUP";

  const eligible =
    payment?.method === "CASH" &&
    payment?.status === "PENDING" &&
    order?.paymentStatus === "PENDING" &&
    ["ONLINE", "FACEBOOK", "POS"].includes(order?.channel) &&
    ["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
      order?.status,
    );

  useEffect(() => {
    setCollected(false);
    setReleased(false);
    setError("");
    setNotice("");
  }, [order?.id]);

  async function confirmCash(event) {
    event.preventDefault();

    if (!eligible || !collected || (pickup && !released) || lock.current) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");

    try {
      const approved = await confirmAction({
        title: "Confirm cash collection",

        message:
          `Confirm that you physically received ${money(payment.amount)} ` +
          `for ${order.reference}. ` +
          (pickup ? "The products have also been handed over." : ""),

        confirmText: "Record as PAID",
      });

      if (!approved) return;

      const { data } = await api.post(
        `/api/management/sales/payments/${payment.id}/confirm-cash`,
        {
          cashCollected: true,
          pickupReleased: pickup && released,
          note: "Cash physically received and verified by management.",
        },
      );

      if (!data.success) {
        throw new Error("Payment was not confirmed.");
      }

      setCollected(false);
      setReleased(false);
      setNotice("Cash received and recorded as PAID.");

      onConfirmed?.();

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Cash confirmation failed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!order?.id) return null;

  return (
    <>
      <PriceAdjustmentPanel
        kind="ORDER"
        recordId={order.id}
        refreshKey={`${order.status}:${order.paymentStatus}:${order.total}`}
        onUpdated={onConfirmed}
      />

      <OrderReschedulePanel
        key={order.id}
        order={order}
        onUpdated={onConfirmed}
      />

      <section className="sales-step" aria-label="Order payment details">
        <h3>Payment details</h3>

        {payment && (
          <>
            <div className="sales-totals">
              <span>Payment method</span>
              <strong>{payment.method}</strong>
            </div>

            <div className="sales-totals">
              <span>Payment status</span>
              <strong>{payment.status}</strong>
            </div>

            <div className="sales-totals">
              <span>Amount</span>
              <strong>{money(payment.amount)}</strong>
            </div>
          </>
        )}

        {eligible && (
          <form onSubmit={confirmCash} className="wsm-form">
            <label className="av-cash-confirm-row">
              <input
                type="checkbox"
                checked={collected}
                disabled={busy}
                onChange={(e) => setCollected(e.target.checked)}
              />

              <span>
                I physically received and counted {money(payment.amount)} in
                cash.
              </span>
            </label>

            {pickup && (
              <label className="av-cash-confirm-row">
                <input
                  type="checkbox"
                  checked={released}
                  disabled={busy}
                  onChange={(e) => setReleased(e.target.checked)}
                />

                <span>The products were handed over to the customer.</span>
              </label>
            )}

            <button
              className="sales-primary"
              type="submit"
              disabled={busy || !collected || (pickup && !released)}
            >
              <ShieldCheck size={16} />

              {busy ? "Saving…" : "Confirm Cash"}
            </button>
          </form>
        )}

        {Number(payment?.canRefund) === 1 && payment.status === "PAID" && (
          <CashRefundForm
            key={payment.id}
            kind="ORDER"
            payment={payment}
            onRefunded={(data) => {
              setNotice(data.message);
              onConfirmed?.();
            }}
          />
        )}

        {payment?.status === "REFUNDED" && (
          <div role="status">
            <p>
              Refund reference: <strong>{payment.refundReference}</strong>
            </p>

            <p>Reason: {payment.refundReason}</p>
          </div>
        )}

        {payment?.status === "PAID" && Number(payment.canRefund) !== 1 && (
          <p className="sales-note">
            This payment is not eligible for a pre-dispatch cash cancellation
            refund. Management must reconcile completed work, stock returns or
            online payments separately.
          </p>
        )}

        {!payment && (
          <p className="sales-note">
            No single matching payment record. Review this transaction in
            Payments.
          </p>
        )}

        {error && (
          <p role="alert" className="sales-error">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="sales-success">
            {notice}
          </p>
        )}

        <Link to="/management/payments">View all payments</Link>
      </section>
    </>
  );
}
