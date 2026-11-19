import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";

import RecordCategoryFilters, {
  field,
  useRecordFilters,
} from "../../components/common/RecordCategoryFilters.jsx";

import ManagementRecordDetailsModal from "../../components/management/ManagementRecordDetailsModal.jsx";

import api from "../../../api/api.js";

import "../../styles/management/sales-live.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const date = (value) => (value ? new Date(value).toLocaleString("en-PH") : "—");

const reference = (payment) =>
  payment.displayOrderNumber || payment.orderNumber;

const keyFor = (payment) => `${payment.channel}:${payment.id}`;

const pickup = (payment) =>
  payment.channel === "POS" && payment.fulfillment === "PICKUP";

function canCollect(payment) {
  if (
    !["ONLINE", "FACEBOOK", "SERVICE", "POS"].includes(payment.channel) ||
    payment.status !== "PENDING" ||
    payment.method !== "CASH"
  ) {
    return false;
  }

  if (pickup(payment)) {
    return payment.orderStatus === "CONFIRMED";
  }

  if (payment.channel === "SERVICE") {
    return ["CONFIRMED", "COMPLETED"].includes(payment.orderStatus);
  }

  return ["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(
    payment.orderStatus,
  );
}

function canRefund(payment) {
  return (
    payment.status === "PAID" &&
    payment.method === "CASH" &&
    Number(payment.canRefund) === 1
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [detailsPayment, setDetailsPayment] = useState(null);
  const [selected, setSelected] = useState(null);

  const [mode, setMode] = useState("collect");

  const [verified, setVerified] = useState(false);
  const [released, setReleased] = useState(false);
  const [note, setNote] = useState("");

  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const lock = useRef(false);

  const closeDetails = useCallback(() => setDetailsPayment(null), []);

  useEffect(() => {
    const refreshList = () => setRefresh((value) => value + 1);

    window.addEventListener("av-management-updated", refreshList);

    return () =>
      window.removeEventListener("av-management-updated", refreshList);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    api
      .get("/api/management/sales/payments", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        const rows = Array.isArray(data.payments) ? data.payments : [];

        setPayments([
          ...new Map(
            rows.map((payment) => [keyFor(payment), payment]),
          ).values(),
        ]);

        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.response?.data?.message || "Cannot load payments.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refresh]);

  const categories = useRecordFilters(payments, [
    field("channel", "Channels"),
    field("method", "Payment methods"),
  ]);

  const filtered = useMemo(
    () =>
      categories.filtered.filter(
        (payment) =>
          (status === "ALL" || payment.status === status) &&
          `${reference(payment)} ${payment.orderNumber} ${
            payment.customer
          } ${payment.channel} ${
            payment.transferReference || ""
          } ${payment.refundReference || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [categories.filtered, search, status],
  );

  const summary = useMemo(
    () =>
      payments.reduce(
        (result, payment) => {
          if (payment.status === "PAID") {
            result.paid += Number(payment.amount);
          }

          if (payment.status === "PENDING") {
            result.pending += Number(payment.amount);
          }

          return result;
        },
        {
          paid: 0,
          pending: 0,
        },
      ),
    [payments],
  );

  function open(payment, nextMode) {
    if (lock.current) return;

    setDetailsPayment(null);
    setSelected(payment);
    setMode(nextMode);

    setVerified(false);
    setReleased(false);
    setNote("");
    setActionError("");
    setSuccess("");
  }

  const refund = mode === "refund";

  const needsHandover = selected && !refund && pickup(selected);

  const eligible =
    selected && (refund ? canRefund(selected) : canCollect(selected));

  const ready =
    eligible &&
    verified &&
    (!needsHandover || released) &&
    (!refund || note.trim().length >= 5);

  async function submit(event) {
    event.preventDefault();

    if (!ready || lock.current) return;

    lock.current = true;

    setBusy(true);
    setActionError("");

    try {
      const id = String(selected.id).replace(/^S/, "");

      const segment =
        selected.channel === "SERVICE" ? "service-payments" : "payments";

      const body = refund
        ? {
            cashReturned: true,
            reason: note.trim(),
          }
        : {
            cashCollected: true,
            pickupReleased: Boolean(needsHandover && released),
            note: note.trim(),
          };

      const action = refund ? "confirm-refund" : "confirm-cash";

      const { data } = await api.post(
        `/api/management/sales/${segment}/${encodeURIComponent(id)}/${action}`,
        body,
      );

      if (!data.success) {
        throw new Error("The operation was not saved.");
      }

      setSuccess(
        refund
          ? `${reference(selected)}: ${
              data.message || "Refund recorded."
            } Voucher: ${data.refundReference || "See payment details"}.`
          : `${reference(selected)}: cash payment recorded as PAID.`,
      );

      setSelected(null);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Could not verify the result. Refresh and check the payment before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function actions(payment) {
    return (
      <>
        {canCollect(payment) && (
          <button
            type="button"
            className="sales-small-action"
            onClick={() => open(payment, "collect")}
          >
            Confirm Cash
          </button>
        )}

        {canRefund(payment) && (
          <button
            type="button"
            className="sales-small-action"
            onClick={() => open(payment, "refund")}
          >
            Cancel &amp; Refund
          </button>
        )}
      </>
    );
  }

  return (
    <div className="sales-ui">
      <header className="sales-hero">
        <div>
          <span className="sales-kicker">
            <CreditCard size={17} /> PAYMENT RECORDS
          </span>

          <h1>Payments</h1>

          <p>
            Product orders and service appointments · real payment records from
            MySQL.
          </p>
        </div>

        <button
          type="button"
          className="sales-refresh"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={17} /> Refresh
        </button>
      </header>

      {error && (
        <p className="sales-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="sales-success" role="status">
          {success}
        </p>
      )}

      <div className="sales-summary-cards">
        <div className="sales-panel">
          <small>Collected payments · latest {payments.length}</small>

          <strong>{money(summary.paid)}</strong>
        </div>

        <div className="sales-panel">
          <small>Pending payments · latest {payments.length}</small>

          <strong>{money(summary.pending)}</strong>
        </div>
      </div>

      <section className="sales-panel">
        <div className="sales-section-head">
          <h2>Payment history</h2>
          <span>{filtered.length} shown</span>
        </div>

        <div className="sales-filters">
          <label className="sales-search">
            <Search size={18} />

            <input
              value={search}
              placeholder="Search reference or customer"
              aria-label="Search payments"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <select
            aria-label="Filter payment status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>

            {[
              ...new Set([
                "PENDING",
                "PAID",
                "FAILED",
                "REFUNDED",
                "CANCELLED",
                ...payments.map((payment) => payment.status).filter(Boolean),
              ]),
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <RecordCategoryFilters filters={categories} />

        {loading ? (
          <p className="sales-empty" role="status">
            Loading payments…
          </p>
        ) : !filtered.length ? (
          <p className="sales-empty">No matching payment records yet.</p>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table av-smart-table av-smart-table--expand">
              <thead>
                <tr>
                  <th data-mobile="primary">Order / Service</th>

                  <th data-mobile="secondary">Customer</th>

                  <th>Channel</th>
                  <th>Method</th>

                  <th data-mobile="status">Status</th>

                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>

                  <th
                    data-mobile="action"
                    className="av-mobile-only av-smart-more-head"
                  >
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((payment) => (
                  <tr className="av-smart-record" key={keyFor(payment)}>
                    <td data-mobile="primary">
                      <strong title={reference(payment)}>
                        {reference(payment)}
                      </strong>
                    </td>

                    <td data-mobile="secondary">{payment.customer}</td>

                    <td>{payment.channel}</td>

                    <td>
                      {payment.method}

                      {payment.transferReference && (
                        <small style={{ display: "block" }}>
                          Ref: {payment.transferReference}
                        </small>
                      )}
                    </td>

                    <td data-mobile="status">
                      <span
                        className={`sales-pill is-${payment.status.toLowerCase()}`}
                      >
                        {payment.status}
                      </span>
                    </td>

                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>

                    <td>
                      {date(
                        payment.refundedAt ||
                          payment.paidAt ||
                          payment.createdAt,
                      )}
                    </td>

                    <td>
                      {actions(payment)}

                      <button
                        type="button"
                        className="sales-small-action"
                        onClick={() => setDetailsPayment(payment)}
                      >
                        View Details
                      </button>
                    </td>

                    <td
                      className="av-mobile-only av-smart-more-cell"
                      data-mobile="action"
                    >
                      <button
                        type="button"
                        className="av-smart-expand-btn"
                        aria-label={`View payment details for ${reference(payment)}`}
                        onClick={() => setDetailsPayment(payment)}
                      >
                        <Eye size={14} aria-hidden="true" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="sales-note">
          Cash refunds are available for eligible unstarted transactions. Online
          refunds and physical returns require separate verification.
        </p>
      </section>

      {detailsPayment && (
        <ManagementRecordDetailsModal
          title="Payment Details"
          subtitle={reference(detailsPayment)}
          onClose={closeDetails}
          fields={[
            {
              label: "Order / Service",
              value: reference(detailsPayment),
            },
            {
              label: "Customer",
              value: detailsPayment.customer,
            },
            {
              label: "Channel",
              value: detailsPayment.channel,
            },
            {
              label: "Method",
              value: detailsPayment.method,
            },
            {
              label: "Payment status",
              value: detailsPayment.status,
            },
            {
              label: "Transaction status",
              value: detailsPayment.orderStatus,
            },
            {
              label: "Amount",
              value: money(detailsPayment.amount),
            },
            {
              label: "Date",
              value: date(detailsPayment.paidAt || detailsPayment.createdAt),
            },

            ...(detailsPayment.transferReference
              ? [
                  {
                    label: "Reference",
                    value: detailsPayment.transferReference,
                  },
                ]
              : []),

            ...(detailsPayment.refundReference
              ? [
                  {
                    label: "Refund voucher",
                    value: detailsPayment.refundReference,
                  },
                  {
                    label: "Refund reason",
                    value: detailsPayment.refundReason,
                  },
                  {
                    label: "Refunded on",
                    value: date(detailsPayment.refundedAt),
                  },
                ]
              : []),
          ]}
        >
          {actions(detailsPayment)}
        </ManagementRecordDetailsModal>
      )}

      {selected && (
        <div
          className="sales-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !lock.current) {
              setSelected(null);
            }
          }}
        >
          <form
            className="sales-panel sales-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-payment-heading"
            onSubmit={submit}
          >
            <h2 id="sales-payment-heading">
              <ShieldCheck size={22} />

              {refund ? "Cancel & Refund" : "Confirm cash collection"}
            </h2>

            <p>
              <strong>{reference(selected)}</strong>
              {" · "}
              {selected.customer}
            </p>

            <p>
              {refund ? "Refund amount" : "Amount to collect"}:{" "}
              <strong>{money(selected.amount)}</strong>
            </p>

            {refund && (
              <p className="sales-note">
                This records money already returned. It does not transfer funds.
                The voucher is generated automatically.
              </p>
            )}

            <label>
              {refund ? "Refund reason (required)" : "Staff note (optional)"}

              <textarea
                value={note}
                required={refund}
                minLength={refund ? 5 : undefined}
                maxLength={refund ? 500 : 250}
                rows={2}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <label className="sales-checkline av-cash-confirm-row">
              <input
                type="checkbox"
                checked={verified}
                disabled={busy}
                onChange={(e) => setVerified(e.target.checked)}
              />

              <span>
                {refund
                  ? "I physically returned the full cash amount to the customer."
                  : "I personally verified that the full cash payment was received."}
              </span>
            </label>

            {needsHandover && (
              <label className="sales-checkline av-cash-confirm-row">
                <input
                  type="checkbox"
                  checked={released}
                  disabled={busy}
                  onChange={(e) => setReleased(e.target.checked)}
                />

                <span>
                  The products have been physically handed over to the customer.
                </span>
              </label>
            )}

            {actionError && (
              <p className="sales-error" role="alert">
                {actionError}
              </p>
            )}

            <div className="sales-modal-actions">
              <button
                className="sales-refresh"
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Back
              </button>

              <button
                className="sales-primary"
                type="submit"
                disabled={!ready || busy}
              >
                {busy
                  ? "Recording…"
                  : refund
                    ? "Confirm Cancellation & Refund"
                    : "Record as PAID"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
