import { useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw, Search, ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import "../../styles/management/sales-live.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);
const date = (value) => (value ? new Date(value).toLocaleString("en-PH") : "—");

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);
  const [collected, setCollected] = useState(false);
  const [note, setNote] = useState("");
  const isManual =
    selected && ["GCASH", "BANK_TRANSFER"].includes(selected.method);
  const canVerifyManual = ["OWNER", "MANAGER"].includes(getStaff()?.role);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/management/sales/payments", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setPayments(data.payments || []);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || "Cannot load payments.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      payments.filter(
        (p) =>
          (status === "ALL" || p.status === status) &&
          `${p.orderNumber} ${p.customer} ${p.channel} ${p.transferReference || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [payments, search, status],
  );
  const summary = useMemo(
    () =>
      payments.reduce(
        (a, p) => {
          if (p.status === "PAID") a.paid += Number(p.amount);
          if (p.status === "PENDING") a.pending += Number(p.amount);
          return a;
        },
        { paid: 0, pending: 0 },
      ),
    [payments],
  );

  function open(p) {
    setSelected(p);
    setCollected(false);
    setNote("");
    setError("");
    setSuccess("");
  }
  async function confirm(event) {
    event.preventDefault();
    if (!selected || !collected || busyId) return;
    if (
      !window.confirm(
        isManual
          ? `Confirm actual receipt of ${money(selected.amount)} for ${selected.orderNumber}? Check the bank/GCash app first.`
          : `Confirm you physically collected ${money(selected.amount)} for ${selected.orderNumber}?`,
      )
    )
      return;
    setBusyId(selected.id);
    setError("");
    try {
      const { data } = await api.post(
        selected.channel === "SERVICE"
          ? `/api/management/sales/service-payments/${String(selected.id).replace(/^S/, "")}/${isManual ? "confirm-transfer" : "confirm-cash"}`
          : `/api/management/sales/payments/${selected.id}/${isManual ? "confirm-transfer" : "confirm-cash"}`,
        isManual
          ? {
              verifiedExternally: true,
              reference: selected.transferReference,
              note: note.trim(),
            }
          : { cashCollected: true, note: note.trim() },
      );
      if (!data.success) throw new Error("Payment confirmation was not saved.");
      setSuccess(
        `${isManual ? selected.method : "Cash"} payment for ${selected.orderNumber} confirmed in MySQL.`,
      );
      setSelected(null);
      setRefresh((n) => n + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not confirm payment.",
      );
    } finally {
      setBusyId(null);
    }
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
              placeholder="Search order, service, or customer"
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
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        {loading ? (
          <p className="sales-empty" role="status">
            Loading payments…
          </p>
        ) : filtered.length === 0 ? (
          <p className="sales-empty">No matching payment records yet.</p>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.orderNumber}</strong>
                    </td>
                    <td>{p.customer}</td>
                    <td>{p.channel}</td>
                    <td>
                      {p.method}
                      {p.transferReference && (
                        <small style={{ display: "block" }}>
                          Ref: {p.transferReference}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className={`sales-pill is-${p.status.toLowerCase()}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <strong>{money(p.amount)}</strong>
                    </td>
                    <td>{date(p.paidAt || p.createdAt)}</td>
                    <td>
                      {["ONLINE", "FACEBOOK", "SERVICE"].includes(p.channel) &&
                      p.status === "PENDING" &&
                      (p.method === "CASH" ||
                        (["GCASH", "BANK_TRANSFER"].includes(p.method) &&
                          p.transferReference &&
                          ["ONLINE", "SERVICE"].includes(p.channel) &&
                          canVerifyManual)) &&
                      [
                        "CONFIRMED",
                        "SCHEDULED",
                        "IN_PROGRESS",
                        "COMPLETED",
                      ].includes(p.orderStatus) ? (
                        <button
                          type="button"
                          className="sales-small-action"
                          onClick={() => open(p)}
                        >
                          {p.method === "CASH"
                            ? "Confirm cash"
                            : "Verify transfer"}
                        </button>
                      ) : (
                        <span className="sales-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sales-note">
          Refunds are not simulated here. A refund needs its own verified
          return-of-funds workflow.
        </p>
      </section>
      {selected && (
        <div
          className="sales-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setSelected(null);
          }}
        >
          <form
            className="sales-panel sales-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-confirm-payment-heading"
            onSubmit={confirm}
          >
            <h2 id="sales-confirm-payment-heading">
              <ShieldCheck size={22} />{" "}
              {isManual
                ? "Verify external transfer"
                : "Confirm actual cash collection"}
            </h2>
            <p>
              <strong>{selected.orderNumber}</strong> · {selected.customer}
            </p>
            <p>
              Amount to confirm: <strong>{money(selected.amount)}</strong>
            </p>
            {isManual && (
              <p>
                <strong>Submitted reference:</strong>{" "}
                {selected.transferReference}
                <br />
                Verify the exact amount, recipient, and reference in the
                official bank/GCash merchant account before continuing.
              </p>
            )}
            <label>
              Staff note{" "}
              {isManual ? "(required, min 10 characters)" : "(optional)"}
              <textarea
                value={note}
                maxLength={250}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="sales-checkline">
              <input
                type="checkbox"
                checked={collected}
                onChange={(e) => setCollected(e.target.checked)}
              />
              <span>
                {isManual
                  ? "I verified this exact transfer and amount in the official merchant account. A reference/screenshot alone is not proof."
                  : "I personally verified that this cash payment was received."}
              </span>
            </label>
            <div className="sales-modal-actions">
              <button
                className="sales-refresh"
                type="button"
                onClick={() => setSelected(null)}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>
              <button
                className="sales-primary"
                type="submit"
                disabled={
                  !collected ||
                  Boolean(busyId) ||
                  (isManual && note.trim().length < 10)
                }
              >
                {busyId ? "Recording…" : "Record as PAID"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
