import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";
import PayMongoAction from "../payments/PayMongoAction.jsx";
import { getStaff } from "../../utils/authMock.js";
import "../../styles/management/service-operations-panels.css";
import "../../styles/ecommerce/paymongo.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value) || 0,
  );
const date = (value) =>
  value ? new Date(value).toLocaleString("en-PH") : "Not paid yet";

export default function ServicePaymentPanel({ requestId, refreshKey = 0 }) {
  const role = getStaff()?.role;
  const canConfirmCash = ["OWNER", "MANAGER"].includes(role);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cashReturned, setCashReturned] = useState(false);
  const [refundReference, setRefundReference] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!requestId) return;
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
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestId, refreshKey, version]);

  const ready = ["CONFIRMED", "COMPLETED"].includes(payment?.serviceStatus);
  const pending = payment?.status === "PENDING";
  const isCash = payment?.method === "CASH";
  const canRecordRefund =
    canConfirmCash &&
    isCash &&
    payment?.status === "PAID" &&
    ["PENDING", "CONFIRMED"].includes(payment?.serviceStatus) &&
    !Boolean(payment?.workStarted);

  async function confirmRefund(event) {
    event.preventDefault();
    if (
      !canRecordRefund ||
      !cashReturned ||
      refundReference.trim().length < 5 ||
      refundReason.trim().length < 5 ||
      busy
    )
      return;
    const approved = await confirmAction({
      title: "Record completed cash refund",
      message: `You are confirming that ${money(payment.amount)} was ALREADY physically returned to the customer. Reference: ${refundReference.trim()}. This records the refund; it does not send money. Continue?`,
      confirmText: "Record cash refund",
      danger: true,
    });
    if (!approved) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(
        `/api/management/sales/service-payments/${payment.id}/confirm-refund`,
        {
          cashReturned: true,
          receiptReference: refundReference.trim(),
          reason: refundReason.trim(),
        },
      );
      if (!data.success) throw new Error("Refund confirmation was not saved.");
      setNotice(
        data.message || "Cash refund recorded. You may cancel the request now.",
      );
      setCashReturned(false);
      setRefundReference("");
      setRefundReason("");
      setVersion((v) => v + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to record refund.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash(event) {
    event.preventDefault();
    if (!pending || !ready || !isCash || !verified || !canConfirmCash || busy)
      return;
    const approved = await confirmAction({
      title: "Confirm cash collection",
      message: `Confirm that you physically received ${money(payment.amount)} in cash for this service. This will record the payment as PAID.`,
      confirmText: "Record as PAID",
    });
    if (!approved) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(
        `/api/management/sales/service-payments/${payment.id}/confirm-cash`,
        {
          cashCollected: true,
          note: "Cash physically collected and confirmed by management.",
        },
      );
      if (!data.success) throw new Error("Payment was not confirmed.");
      setNotice("Cash payment recorded as paid.");
      setVerified(false);
      setVersion((v) => v + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Cash confirmation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

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
          onClick={() => setVersion((v) => v + 1)}
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
            <div>
              <span>Amount</span>
              <strong>{money(payment.amount)}</strong>
            </div>
            <div>
              <span>Method</span>
              <strong>
                {payment.method === "BANK_TRANSFER"
                  ? "QR Ph / bank app"
                  : payment.method}
              </strong>
            </div>
            <div>
              <span>Payment status</span>
              <strong>{payment.status}</strong>
            </div>
            <div>
              <span>Service status</span>
              <strong>{payment.serviceStatus}</strong>
            </div>
            <div>
              <span>Paid on</span>
              <strong>{date(payment.paidAt)}</strong>
            </div>
            <div>
              <span>Confirmed by</span>
              <strong>
                {payment.verifiedBy ||
                  (payment.status === "PAID" && !isCash
                    ? "PayMongo"
                    : "Not yet")}
              </strong>
            </div>
          </div>
          {payment.status === "PAID" && (
            <p className="service-payment-panel__help">
              This payment is confirmed. Do not collect again.
            </p>
          )}
          {payment.status === "REFUNDED" && (
            <div className="service-payment-panel__refund-record" role="status">
              <strong>Cash refund recorded</strong>
              <p>
                The original paid record is preserved for auditing. The amount
                has been recorded as returned; do not refund twice.
              </p>
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
                You can now select Cancel request below, provided work has not
                started.
              </small>
            </div>
          )}
          {canRecordRefund && (
            <form
              className="service-payment-panel__refund-form"
              onSubmit={confirmRefund}
            >
              <div>
                <h4>Record an already completed cash refund</h4>
                <p>
                  Only use this after the actual cash has been returned. The
                  form does not transfer money.
                </p>
              </div>
              <label className="wsm-field">
                Refund receipt or voucher reference
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={120}
                  placeholder="Existing refund receipt / voucher #"
                  value={refundReference}
                  disabled={busy}
                  onChange={(event) => setRefundReference(event.target.value)}
                />
              </label>
              <label className="wsm-field">
                Reason for refund
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  placeholder="Briefly describe why cash was refunded"
                  value={refundReason}
                  disabled={busy}
                  onChange={(event) => setRefundReason(event.target.value)}
                />
              </label>
              <label className="service-payment-panel__checkbox av-cash-confirm-row">
                <input
                  type="checkbox"
                  checked={cashReturned}
                  disabled={busy}
                  onChange={(event) => setCashReturned(event.target.checked)}
                />
                <span>
                  I confirm that {money(payment.amount)} was physically returned
                  to the customer.
                </span>
              </label>
              <button
                type="submit"
                className="wsm-primary"
                disabled={
                  busy ||
                  !cashReturned ||
                  refundReference.trim().length < 5 ||
                  refundReason.trim().length < 5
                }
              >
                <ShieldCheck size={16} />{" "}
                {busy ? "Saving…" : "Record completed cash refund"}
              </button>
            </form>
          )}
          {canConfirmCash && payment.status === "PAID" && !canRecordRefund && (
            <p className="service-payment-panel__help">
              A refund cannot be recorded here after work has started, or for a
              non-cash method. Ask the Owner to reconcile the payment and
              service history.
            </p>
          )}
          {pending && !ready && (
            <p className="service-payment-panel__help">
              Confirm the service and the final agreed fee before collecting
              payment.
            </p>
          )}
          {pending && ready && !isCash && (
            <>
              <p className="service-payment-panel__help">
                Generate a secure PayMongo link. Share it with the customer.
                Only PayMongo can mark this online payment Paid.
              </p>
              <PayMongoAction kind="SERVICE" identifier={payment.id} staff />
            </>
          )}
          {pending && ready && isCash && canConfirmCash && (
            <form onSubmit={confirmCash}>
              <label className="service-payment-panel__checkbox av-cash-confirm-row">
                <input
                  type="checkbox"
                  checked={verified}
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
      {canConfirmCash && (
        <Link to="/management/payments">View all payments</Link>
      )}
    </section>
  );
}
