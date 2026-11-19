import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

import PayMongoAction from "../payments/PayMongoAction.jsx";
import PriceAdjustmentPanel from "./PriceAdjustmentPanel.jsx";
import CashRefundForm from "./CashRefundForm.jsx";

import { getStaff } from "../../utils/authMock.js";

import "../../styles/management/service-operations-panels.css";
import "../../styles/ecommerce/paymongo.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const date = (value) =>
  value ? new Date(value).toLocaleString("en-PH") : "Not paid yet";

export default function ServicePaymentPanel({ requestId, refreshKey = 0 }) {
  const canAdjust = ["OWNER", "MANAGER"].includes(getStaff()?.role);

  const [priceRevision, setPriceRevision] = useState(0);

  return (
    <>
      {canAdjust && requestId && (
        <PriceAdjustmentPanel
          key={requestId}
          kind="SERVICE"
          recordId={requestId}
          refreshKey={refreshKey}
          onUpdated={() => setPriceRevision((n) => n + 1)}
        />
      )}

      <ServicePaymentDetails
        key={requestId}
        requestId={requestId}
        refreshKey={`${refreshKey}:${priceRevision}`}
      />
    </>
  );
}

function ServicePaymentDetails({ requestId, refreshKey }) {
  const canConfirmCash = ["OWNER", "MANAGER"].includes(getStaff()?.role);

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  const lock = useRef(false);

  useEffect(() => {
    if (!requestId || !canConfirmCash) return undefined;

    const controller = new AbortController();

    setLoading(true);

    api
      .get(
        `/api/management/services/${encodeURIComponent(requestId)}/payment`,
        { signal: controller.signal },
      )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setPayment(data.payment || null);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPayment(null);
          setError(err.response?.data?.message || "Could not load payment.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestId, refreshKey, version, canConfirmCash]);

  const ready = ["CONFIRMED", "COMPLETED"].includes(payment?.serviceStatus);

  const pending = payment?.status === "PENDING";
  const isCash = payment?.method === "CASH";

  const canRecordRefund =
    canConfirmCash &&
    isCash &&
    payment?.status === "PAID" &&
    ["PENDING", "CONFIRMED"].includes(payment?.serviceStatus) &&
    Number(payment?.workStarted) === 0;

  async function confirmCash(event) {
    event.preventDefault();

    if (
      !pending ||
      !ready ||
      !isCash ||
      !verified ||
      !canConfirmCash ||
      lock.current
    ) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const approved = await confirmAction({
        title: "Confirm cash collection",
        message:
          `Confirm that you physically received ` +
          `${money(payment.amount)} in cash for this service.`,
        confirmText: "Record as PAID",
      });

      if (!approved) return;

      const { data } = await api.post(
        `/api/management/sales/service-payments/${payment.id}/confirm-cash`,
        {
          cashCollected: true,
          note: "Cash physically collected and confirmed by management.",
        },
      );

      if (!data.success) {
        throw new Error("Payment was not confirmed.");
      }

      setNotice("Cash payment recorded as paid.");
      setVerified(false);
      setVersion((n) => n + 1);

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

  if (!canConfirmCash) return null;

  return (
    <section
      className="service-payment-panel"
      aria-label="Service payment details"
    >
      <div className="service-payment-panel__heading">
        <div className="service-payment-panel__heading-text">
          <CreditCard size={20} />

          <div>
            <h3>Payment details</h3>
            <p>Saved Management payment record.</p>
          </div>
        </div>

        <button
          type="button"
          className="wsm-secondary"
          onClick={() => setVersion((n) => n + 1)}
          disabled={loading || busy}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {loading ? (
        <p role="status">Loading payment…</p>
      ) : payment ? (
        <>
          <div className="service-payment-panel__grid">
            {[
              ["Amount", money(payment.amount)],
              [
                "Method",
                payment.method === "BANK_TRANSFER"
                  ? "QR Ph / bank app"
                  : payment.method,
              ],
              ["Payment status", payment.status],
              ["Service status", payment.serviceStatus],
              ["Paid on", date(payment.paidAt)],
              [
                "Confirmed by",
                payment.verifiedBy ||
                  (payment.status === "PAID" && !isCash
                    ? "PayMongo"
                    : "Not yet"),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          {payment.status === "PAID" && (
            <p className="service-payment-panel__help">
              This payment is confirmed. Do not collect again.
            </p>
          )}

          {payment.status === "REFUNDED" && (
            <div className="service-payment-panel__refund-record" role="status">
              <strong>Cash refund recorded</strong>

              <p>Do not refund the same payment again.</p>

              <dl className="service-payment-panel__refund-details">
                <div>
                  <dt>Refund reference</dt>
                  <dd>{payment.refundReference}</dd>
                </div>

                <div>
                  <dt>Refunded on</dt>
                  <dd>{date(payment.refundedAt)}</dd>
                </div>

                <div>
                  <dt>Recorded by</dt>
                  <dd>{payment.refundedBy || "Management"}</dd>
                </div>

                {payment.refundReason && (
                  <div>
                    <dt>Reason</dt>
                    <dd>{payment.refundReason}</dd>
                  </div>
                )}
              </dl>

              <small>
                You may now cancel the request if work has not started.
              </small>
            </div>
          )}

          {canRecordRefund && (
            <CashRefundForm
              key={payment.id}
              kind="SERVICE"
              payment={payment}
              onRefunded={(data) => {
                setNotice(`${data.message} Reference: ${data.refundReference}`);

                setVersion((n) => n + 1);
              }}
            />
          )}

          {payment.status === "PAID" && !canRecordRefund && (
            <p className="service-payment-panel__help">
              Started work and online payments require separate refund
              reconciliation.
            </p>
          )}

          {pending && !ready && (
            <p className="service-payment-panel__help">
              Confirm the service and final fee before collecting payment.
            </p>
          )}

          {pending && ready && !isCash && (
            <>
              <p className="service-payment-panel__help">
                Generate a secure PayMongo link. Only PayMongo can verify online
                payment.
              </p>

              <PayMongoAction kind="SERVICE" identifier={payment.id} staff />
            </>
          )}

          {pending && ready && isCash && (
            <form onSubmit={confirmCash}>
              <label className="service-payment-panel__checkbox av-cash-confirm-row">
                <input
                  type="checkbox"
                  checked={verified}
                  disabled={busy}
                  onChange={(e) => setVerified(e.target.checked)}
                />

                <span>I physically received and counted the cash.</span>
              </label>

              <button
                className="wsm-primary"
                type="submit"
                disabled={!verified || busy}
              >
                <ShieldCheck size={16} />

                {busy ? "Saving…" : "Confirm Cash Payment"}
              </button>
            </form>
          )}
        </>
      ) : (
        <p>No payment record exists for this service.</p>
      )}

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

      <Link to="/management/payments">View all payments</Link>
    </section>
  );
}
