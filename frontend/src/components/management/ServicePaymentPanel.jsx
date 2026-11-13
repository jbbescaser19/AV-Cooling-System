import { confirmAction } from "../../utils/confirmAction.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
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

  async function confirmCash(event) {
    event.preventDefault();
    if (!pending || !ready || !isCash || !verified || !canConfirmCash || busy)
      return;
    if (
      !(await confirmAction(
        `Confirm physically received cash of ${money(payment.amount)}?`,
      ))
    )
      return;
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
              <label className="service-payment-panel__checkbox">
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
