import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Eye,
  CalendarDays,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import { getStaff } from "../../utils/authMock";
import "../../styles/management/sales-live.css";
import "../../styles/management/av-records.css";
import "../../styles/management/record-pagination.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

function showDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH");
}

function getPhoneHref(raw) {
  const phone = String(raw || "").replace(/[^\d+]/g, "");
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `tel:${phone}` : null;
}

function nextOnlineEvent(order) {
  // Customer has already chosen an available slot at checkout.
  // Staff only confirms the order; rescheduling is a separate workflow.
  return order?.channel === "ONLINE" && order.status === "PENDING"
    ? ["ORDER_ACCEPTED", "Confirm order"]
    : null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [note, setNote] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const modalRef = useRef(null);
  const hasLoadedRef = useRef(false);

  useRealtimeRefresh(["orders", "payments", "jobs", "schedules"], setRefresh);

  const rawOrderId = searchParams.get("orderId");
  const orderId =
    rawOrderId && /^[1-9]\d*$/.test(rawOrderId) ? Number(rawOrderId) : null;

  function closeDetails(force = false) {
    if (busy && !force) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("orderId");
      return next;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedRef.current) setLoading(true);
    api
      .get("/api/management/sales/orders", {
        signal: controller.signal,
        params: {
          page,
          channel,
          status: statusFilter,
          search: debouncedSearch,
        },
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
          hasLoadedRef.current = true;
          setTotal(Number(data.total) || 0);
          setTotalPages(Math.max(1, Number(data.totalPages) || 1));
          setError("");
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message || "Unable to load orders.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh, page, channel, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!orderId || !Number.isSafeInteger(orderId)) {
      setDetails(null);
      setDetailsError("");
      return;
    }
    const controller = new AbortController();
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    api
      .get(`/api/management/sales/orders/${orderId}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setDetails(data.order || null);
          setNote("");
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setDetailsError(
            requestError.response?.data?.message ||
              "Cannot load this order's details.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [orderId, refresh]);

  useEffect(() => {
    if (!orderId) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape" && !busy) closeDetails();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // closeDetails is intentionally derived from the current URL and busy state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, busy]);

  const filtered = orders;

  const listRow = orders.find((item) => Number(item.id) === orderId);
  const selected = details ? { ...listRow, ...details } : listRow;
  const staffRole = getStaff()?.role;
  const canApprove = ["OWNER", "MANAGER"].includes(staffRole);
  const canConfirm = canApprove || staffRole === "SALES_CASHIER";
  const action = selected && canConfirm ? nextOnlineEvent(selected) : null;
  const cancelCode =
    selected?.status === "PENDING"
      ? "ORDER_DECLINED"
      : "ORDER_CANCELLED_BY_STAFF";
  const needsFieldWork =
    details?.fulfillment === "DELIVERY" ||
    details?.items?.some((item) => Boolean(Number(item.installationIncluded)));
  const mayCancel =
    canApprove &&
    selected?.channel === "ONLINE" &&
    selected.paymentStatus === "PENDING" &&
    ["PENDING", "CONFIRMED", "SCHEDULED"].includes(selected.status);

  async function apply(eventCode, label, reason = "") {
    if (!details || !selected || busy) return;
    if (!selected.orderNumber) {
      setError(
        "This order's internal reference is missing. Refresh the record before changing its status.",
      );
      return;
    }
    if (eventCode === "ORDER_ACCEPTED" && needsFieldWork && !details.schedule) {
      setError(
        "This order has no saved appointment. Please arrange an available slot using the Booking Calendar before confirming.",
      );
      return;
    }
    if (
      ["ORDER_CANCELLED_BY_STAFF", "ORDER_DECLINED"].includes(eventCode) &&
      reason.trim().length < 5
    ) {
      setError("Please enter a reason with at least 5 characters.");
      return;
    }
    if (!window.confirm(`${label} for ${selected.reference}?`)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(
        `/api/management/orders/${encodeURIComponent(selected.orderNumber)}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode,
          schedule: null, // Use the appointment saved at checkout; never replace it here.
          technicianIds: [], // Team is assigned separately after confirmation.
          note: reason.trim(),
        },
      );
      if (!data.success) throw new Error("The order update was not confirmed.");
      setSuccess(
        eventCode === "ORDER_ACCEPTED"
          ? `Order confirmed. ${data.workOrders?.length || 0} job(s) created. Management can assign the team before work begins.`
          : `${label} recorded for ${selected.reference}.`,
      );
      closeDetails(true);
      setRefresh((count) => count + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not update the order.",
      );
    } finally {
      setBusy(false);
    }
  }

  const phone = details?.phone?.trim() || "";
  const phoneHref = getPhoneHref(phone);

  return (
    <div className="sales-ui av-records-responsive av-orders-page">
      <header className="sales-hero">
        <div>
          <span className="sales-kicker">
            <Package size={17} /> ORDERS
          </span>
          <h1>All orders</h1>
          <p>
            Online, Facebook Messenger and walk-in POS sales saved in MySQL.
          </p>
        </div>
        <button
          className="sales-refresh"
          type="button"
          disabled={loading || busy}
          onClick={() => setRefresh((count) => count + 1)}
        >
          <RefreshCw size={17} /> Refresh
        </button>
      </header>

      {error && (
        <p role="alert" className="sales-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="sales-success">
          {success}
        </p>
      )}

      <section className="sales-panel" aria-label="Order records">
        <div className="sales-section-head">
          <h2>Order records</h2>
          <span>
            {total} matching orders · page {page} of {totalPages}
          </span>
        </div>
        <div className="sales-filters">
          <label className="sales-search">
            <Search size={17} />
            <input
              placeholder="Search orders and customers"
              aria-label="Search orders"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter by channel"
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All channels</option>
            <option value="ONLINE">Online</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="POS">Walk-in POS</option>
          </select>
          <select
            aria-label="Filter by order status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All statuses</option>
            {[
              "PENDING",
              "CONFIRMED",
              "SCHEDULED",
              "IN_PROGRESS",
              "COMPLETED",
              "CANCELLED",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="sales-empty" role="status">
            Loading orders…
          </p>
        ) : !filtered.length ? (
          <p className="sales-empty">No matching orders found.</p>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table av-smart-table">
              <thead>
                <tr>
                  <th data-mobile="primary">Order</th>
                  <th data-mobile="secondary">Customer</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th data-mobile="status">Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Schedule</th>
                  <th data-mobile="action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Order" data-mobile="primary">
                      <strong>{row.reference}</strong>
                    </td>
                    <td data-label="Customer" data-mobile="secondary">
                      {row.customer}
                    </td>
                    <td data-label="Source">{row.channel}</td>
                    <td data-label="Contact">
                      {getPhoneHref(row.contact) ? (
                        <a href={getPhoneHref(row.contact)}>{row.contact}</a>
                      ) : (
                        row.contact || "Not provided"
                      )}
                    </td>
                    <td data-label="Status" data-mobile="status">
                      <span
                        className={`sales-pill is-${String(row.status).toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td data-label="Payment">
                      <span
                        className={`sales-pill is-${String(row.paymentStatus).toLowerCase()}`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td data-label="Total">
                      <strong>{money(row.total)}</strong>
                    </td>
                    <td data-label="Schedule">
                      {row.schedule
                        ? row.schedule.replace("T", " at ")
                        : "Not scheduled"}
                    </td>
                    <td data-label="Action" data-mobile="action">
                      <button
                        type="button"
                        className="sales-small-action av-smart-view"
                        aria-label={`View and manage order ${row.reference}`}
                        onClick={() =>
                          setSearchParams((previous) => {
                            const next = new URLSearchParams(previous);
                            next.set("orderId", String(row.id));
                            return next;
                          })
                        }
                      >
                        <Eye size={15} aria-hidden="true" />{" "}
                        <span className="av-smart-view-text">View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 && (
          <nav className="av-management-pages" aria-label="Order pages">
            <span>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of{" "}
              {total}
            </span>
            <div>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>

      {orderId && (
        <div
          className="sales-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <section
            className="sales-panel sales-modal av-orders-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            tabIndex={-1}
            ref={modalRef}
          >
            <div className="sales-section-head">
              <h2 id="order-detail-title">
                {selected?.reference || `Order #${orderId}`}
              </h2>
              <button
                className="sales-small-action"
                type="button"
                onClick={closeDetails}
                disabled={busy}
                aria-label="Close order details"
              >
                <X size={18} />
              </button>
            </div>
            {detailsLoading && <p role="status">Loading order details…</p>}
            {detailsError && (
              <p role="alert" className="sales-error">
                {detailsError}
              </p>
            )}
            {details && (
              <>
                <p>
                  <strong>Customer:</strong> {details.customer}
                </p>
                <p>
                  <strong>Source:</strong>{" "}
                  {details.channel === "FACEBOOK"
                    ? "Facebook Messenger"
                    : details.channel}
                </p>
                <p>
                  <strong>Contact number:</strong>{" "}
                  {phoneHref ? (
                    <a href={phoneHref}>{phone}</a>
                  ) : (
                    phone || "Not provided"
                  )}
                </p>
                <p>
                  <Phone size={15} aria-hidden="true" /> The contact number is
                  saved from the original order or staff-entered Facebook
                  agreement.
                </p>
                <p>
                  <strong>Delivery / pickup:</strong>{" "}
                  {details.fulfillment || "—"}
                </p>
                <p>
                  <MapPin size={15} aria-hidden="true" />{" "}
                  <strong>Address:</strong> {details.address || "Not provided"}
                </p>
                <p>
                  <CalendarDays size={15} aria-hidden="true" />{" "}
                  <strong>Ordered:</strong> {showDate(details.createdAt)}
                </p>
                <div className="sales-totals">
                  <span>Order status</span>
                  <strong>{details.status}</strong>
                </div>
                <div className="sales-totals">
                  <span>Payment status</span>
                  <strong>{details.paymentStatus}</strong>
                </div>
                <div className="sales-totals sales-total">
                  <span>Total</span>
                  <strong>{money(details.total)}</strong>
                </div>
                <h3>Order items</h3>
                {!details.items?.length ? (
                  <p>No order items recorded.</p>
                ) : (
                  details.items.map((item, index) => (
                    <div
                      className="sales-totals"
                      key={`${item.name}-${item.model}-${index}`}
                    >
                      <span>
                        {item.quantity} × {item.name} · {item.model}
                      </span>
                      <strong>{money(item.lineTotal)}</strong>
                    </div>
                  ))
                )}
                {needsFieldWork &&
                  !["PENDING", "CANCELLED"].includes(details.status) && (
                    <SourceTeamPanel
                      key={`ORDER-${details.id}`}
                      kind="ORDER"
                      sourceId={details.id}
                    />
                  )}
                {details.channel === "FACEBOOK" && (
                  <p className="sales-note">
                    Facebook cash collection stays under{" "}
                    <Link to="/management/payments">Payments</Link>. Technicians
                    are assigned right here.
                  </p>
                )}
                {details.channel === "POS" && needsFieldWork && (
                  <p className="sales-note">
                    POS installation workers can be changed directly above.
                  </p>
                )}
                {action && (
                  <div className="sales-step av-order-confirm">
                    <h3>Confirm order</h3>
                    <p className="sales-note">
                      The customer already chose an available time. This action
                      confirms the order and keeps that existing appointment.
                    </p>
                    <div className="av-order-confirm__schedule">
                      <CalendarDays size={18} />
                      <div>
                        <small>Reserved appointment · Philippines time</small>
                        <strong>
                          {details.schedule
                            ? `${details.schedule.replace("T", " at ")} (PH time)`
                            : needsFieldWork
                              ? "No appointment recorded"
                              : "No appointment required"}
                        </strong>
                      </div>
                    </div>
                    {needsFieldWork && !details.schedule && (
                      <p className="sales-error" role="alert">
                        The saved appointment is missing. Confirm an available
                        time with the customer in the Booking Calendar first.
                      </p>
                    )}
                    <button
                      className="sales-primary"
                      type="button"
                      disabled={busy || (needsFieldWork && !details.schedule)}
                      onClick={() => apply(action[0], action[1])}
                    >
                      {busy ? "Saving…" : "Confirm order"}
                    </button>
                  </div>
                )}
                {mayCancel && (
                  <div className="sales-step sales-danger-zone">
                    <h3>
                      {selected.status === "PENDING"
                        ? "Decline order"
                        : "Cancel order"}
                    </h3>
                    <label>
                      Reason (required)
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </label>
                    <button
                      className="sales-danger"
                      type="button"
                      disabled={busy || note.trim().length < 5}
                      onClick={() =>
                        apply(cancelCode, "Cancel or decline order", note)
                      }
                    >
                      {selected.status === "PENDING"
                        ? "Decline order"
                        : "Cancel order"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
