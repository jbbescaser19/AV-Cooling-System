import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";

import "../../styles/management/service-operations-panels.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

function formatDate(value) {
  if (!value) return "Not yet paid";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export default function ServicePaymentPanel({ requestId, refreshKey = 0 }) {
  const role = getStaff()?.role;

  const canVerifyTransfer = ["OWNER", "MANAGER"].includes(role);

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!requestId) return undefined;

    const controller = new AbortController();

    setLoading(true);
    setError("");
    setEditing(false);
    setVerified(false);
    setReference("");
    setNote("");

    api
      .get(
        `/api/management/services/${encodeURIComponent(requestId)}/payment`,
        {
          signal: controller.signal,
        },
      )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setPayment(data.payment || null);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setPayment(null);

          setError(
            requestError.response?.data?.message ||
              "Unable to load the service payment.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [requestId, refreshKey, version]);

  const readyToConfirm = ["CONFIRMED", "COMPLETED"].includes(
    payment?.serviceStatus,
  );

  const isCash = payment?.method === "CASH";

  const hasClaim = Boolean(payment?.transferReference);

  const canConfirm =
    payment?.status === "PENDING" &&
    readyToConfirm &&
    (isCash || (canVerifyTransfer && hasClaim));

  async function submit(event) {
    event.preventDefault();

    if (!canConfirm || busy || !verified) {
      return;
    }

    if (!isCash && (reference.trim().length < 6 || note.trim().length < 10)) {
      setError(
        "Enter the exact transfer reference and a verification note of at least 10 characters.",
      );
      return;
    }

    const action = isCash ? "confirm-cash" : "confirm-transfer";

    const description = isCash
      ? "physically received the cash"
      : "verified the funds in the official receiving account";

    if (
      !window.confirm(
        `Confirm you ${description} for Service #${requestId} (${money(payment.amount)})?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const body = isCash
        ? {
            cashCollected: true,
            note: note.trim(),
          }
        : {
            verifiedExternally: true,
            reference: reference.trim(),
            note: note.trim(),
          };

      const { data } = await api.post(
        `/api/management/sales/service-payments/${payment.id}/${action}`,
        body,
      );

      if (!data?.success) {
        throw new Error("Payment confirmation failed.");
      }

      setNotice(
        "Payment verified and recorded. The responsible staff member is saved in Audit Logs.",
      );

      setEditing(false);

      setVersion((value) => value + 1);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not confirm this payment.",
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
          <CreditCard size={20} aria-hidden="true" />

          <div>
            <h3>Payment details</h3>

            <p>Same payment record used in Management Payments.</p>
          </div>
        </div>

        <button
          type="button"
          className="wsm-secondary"
          aria-label="Refresh service payment"
          disabled={loading || busy}
          onClick={() => setVersion((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p role="status">Loading payment details…</p>
      ) : payment ? (
        <>
          <div className="service-payment-panel__grid">
            <div>
              <span>Amount</span>

              <strong>{money(payment.amount)}</strong>
            </div>

            <div>
              <span>Method</span>

              <strong>{String(payment.method).replaceAll("_", " ")}</strong>
            </div>

            <div>
              <span>Payment status</span>

              <strong
                className={`service-payment-panel__status is-${String(payment.status).toLowerCase()}`}
              >
                {payment.status}
              </strong>
            </div>

            <div>
              <span>Service status</span>

              <strong>{payment.serviceStatus}</strong>
            </div>

            <div>
              <span>Paid on</span>

              <strong>{formatDate(payment.paidAt)}</strong>
            </div>

            <div>
              <span>Verified by</span>

              <strong>{payment.verifiedBy || "Not yet verified"}</strong>
            </div>
          </div>

          {payment.transferReference && (
            <p className="service-payment-panel__reference">
              <strong>Submitted transfer reference:</strong>{" "}
              {payment.transferReference}
            </p>
          )}

          {payment.status === "PENDING" && !readyToConfirm && (
            <p className="service-payment-panel__help">
              Accept or confirm the service request before marking a payment as
              Paid.
            </p>
          )}

          {payment.status === "PENDING" && !isCash && !hasClaim && (
            <p className="service-payment-panel__help">
              Waiting for a customer transaction reference. Do not mark a
              transfer Paid without independent verification.
            </p>
          )}

          {payment.status === "PENDING" && !isCash && !canVerifyTransfer && (
            <p className="service-payment-panel__help">
              Only an Owner or Manager can verify GCash or bank transfers.
            </p>
          )}

          {payment.notes && payment.status === "PAID" && (
            <p className="service-payment-panel__help">
              Payment record note: {payment.notes}
            </p>
          )}

          {canConfirm && !editing && (
            <button
              type="button"
              className="wsm-primary service-payment-panel__action"
              onClick={() => setEditing(true)}
            >
              <ShieldCheck size={16} />

              {isCash ? "Confirm collected cash" : "Verify transfer"}
            </button>
          )}

          {canConfirm && editing && (
            <form className="service-payment-panel__form" onSubmit={submit}>
              {!isCash && (
                <label className="wsm-field">
                  Reference verified against official account
                  <input
                    required
                    minLength={6}
                    maxLength={100}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Enter the matching transaction reference"
                    disabled={busy}
                  />
                </label>
              )}

              <label className="wsm-field">
                Verification note{" "}
                {isCash ? "(optional)" : "(required, 10+ characters)"}
                <textarea
                  rows={2}
                  maxLength={250}
                  minLength={isCash ? undefined : 10}
                  required={!isCash}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    isCash
                      ? "Where and how cash was received"
                      : "How and where funds were independently verified"
                  }
                  disabled={busy}
                />
              </label>

              <label className="service-payment-panel__checkbox">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(event) => setVerified(event.target.checked)}
                  disabled={busy}
                />

                <span>
                  {isCash
                    ? "I personally collected or verified the physical cash payment."
                    : "I checked the official bank/GCash account and verified actual funds, amount, and reference."}
                </span>
              </label>

              <div className="service-payment-panel__buttons">
                <button
                  className="wsm-primary"
                  type="submit"
                  disabled={busy || !verified}
                >
                  <BadgeCheck size={16} />

                  {busy ? "Saving…" : "Confirm payment"}
                </button>

                <button
                  type="button"
                  className="wsm-secondary"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      ) : !error ? (
        <p className="service-payment-panel__help">
          No payment record exists for this service. Older requests may not have
          a saved payment; do not assume they are Paid.
        </p>
      ) : null}

      {error && (
        <p role="alert" className="wsm-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="wsm-success">
          {notice}
        </p>
      )}

      <Link className="service-payment-panel__link" to="/management/payments">
        Open all payments
      </Link>
    </section>
  );
}
