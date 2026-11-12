import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CalendarClock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import api from "../../../api/api.js";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import OrderRescheduleModal from "../../components/management/OrderRescheduleModal.jsx";
import { getStaff } from "../../utils/authMock";
import "../../styles/management/sales-live.css";
import "../../styles/management/av-records.css";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogSuccess, setDialogSuccess] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");
  const [note, setNote] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const modalRef = useRef(null);

  const rawOrderId = searchParams.get("orderId");
  const orderId =
    rawOrderId && /^[1-9]\d*$/.test(rawOrderId) ? Number(rawOrderId) : null;

  function closeDetails(force = false) {
    if ((busy || rescheduleOpen) && !force) return;
    setDialogError("");
    setDialogSuccess("");
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("orderId");
      return next;
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/management/sales/orders", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
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
  }, [refresh]);

  useEffect(() => {
    if (!orderId || !Number.isSafeInteger(orderId)) {
      setDetails(null);
      setDetailsError("");
      setRescheduleOpen(false);
      setDialogError("");
      return;
    }
    const controller = new AbortController();
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    setDialogError("");
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
      if (event.key === "Escape" && !busy && !rescheduleOpen) closeDetails();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // closeDetails is intentionally derived from the current URL and busy state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, busy, rescheduleOpen]);

  const filtered = useMemo(
    () =>
      orders.filter(
        (row) =>
          (channel === "ALL" || row.channel === channel) &&
          `${row.reference} ${row.customer} ${row.contact || ""} ${row.status} ${row.channel} ${row.paymentStatus}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [orders, channel, search],
  );

  const listRow = orders.find((item) => Number(item.id) === orderId);
  const selected = details ? { ...listRow, ...details } : listRow;
  const staffRole = getStaff()?.role;
  const canApprove = ["OWNER", "MANAGER"].includes(staffRole);
  const canConfirm = canApprove;
  const action = selected && canConfirm ? nextOnlineEvent(selected) : null;
  const cancelCode =
    selected?.status === "PENDING"
      ? "ORDER_DECLINED"
      : "ORDER_CANCELLED_BY_STAFF";
  const needsFieldWork =
    details?.fulfillment === "DELIVERY" ||
    details?.items?.some((item) => Boolean(Number(item.installationIncluded)));
  const fieldWorkStarted = Boolean(Number(selected?.workAlreadyStarted));
  const mayCancel =
    canApprove &&
    selected?.channel === "ONLINE" &&
    selected.paymentStatus === "PENDING" &&
    ["PENDING", "CONFIRMED", "SCHEDULED"].includes(selected.status) &&
    !fieldWorkStarted &&
    !Boolean(Number(selected?.outForDelivery)) &&
    !Boolean(Number(selected?.delivered));
  const mayReschedule =
    canApprove &&
    selected?.channel === "ONLINE" &&
    Boolean(details?.schedule) &&
    ["PENDING", "CONFIRMED", "SCHEDULED"].includes(selected.status) &&
    !fieldWorkStarted &&
    !Boolean(Number(selected?.outForDelivery));

  async function apply(eventCode, label, reason = "") {
    if (!details || !selected || busy) return;
    if (eventCode === "ORDER_ACCEPTED" && needsFieldWork && !details.schedule) {
      setDialogError(
        "This order has no saved appointment. Please arrange an available slot using the Booking Calendar before confirming.",
      );
      return;
    }
    if (
      ["ORDER_CANCELLED_BY_STAFF", "ORDER_DECLINED"].includes(eventCode) &&
      reason.trim().length < 5
    ) {
      setDialogError("Please enter a reason with at least 5 characters.");
      return;
    }
    if (!window.confirm(`${label} for ${selected.reference}?`)) return;
    setBusy(true);
    setDialogError("");
    setSuccess("");
    try {
      const { data } = await api.post(
        `/api/management/orders/${encodeURIComponent(selected.reference)}/events`,
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
      setDialogError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not update the order.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleOrder(nextSchedule, reason) {
    if (!selected || busy || !mayReschedule) return;
    if (
      !nextSchedule ||
      nextSchedule === details.schedule ||
      reason.trim().length < 5
    ) {
      setRescheduleError(
        "Choose a new available appointment and enter a reason (5+ characters).",
      );
      return;
    }
    setBusy(true);
    setRescheduleError("");
    setDialogError("");
    try {
      const { data } = await api.post(
        `/api/management/orders/${encodeURIComponent(selected.reference)}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode: "SCHEDULE_CHANGED",
          schedule: nextSchedule,
          technicianIds: [],
          note: reason.trim(),
        },
      );
      if (!data.success) throw new Error("The new appointment was not saved.");
      setRescheduleOpen(false);
      setDialogSuccess(
        `Appointment moved to ${nextSchedule.replace("T", " at ")} (PH time).`,
      );
      setRefresh((count) => count + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setRescheduleError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Rescheduling failed. Please refresh available slots.",
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
          <span>{filtered.length} shown</span>
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
            onChange={(event) => setChannel(event.target.value)}
          >
            <option value="ALL">All channels</option>
            <option value="ONLINE">Online</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="POS">Walk-in POS</option>
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
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Schedule</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Order">
                      <strong>{row.reference}</strong>
                    </td>
                    <td data-label="Customer">{row.customer}</td>
                    <td data-label="Source">{row.channel}</td>
                    <td data-label="Contact">
                      {getPhoneHref(row.contact) ? (
                        <a href={getPhoneHref(row.contact)}>{row.contact}</a>
                      ) : (
                        row.contact || "Not provided"
                      )}
                    </td>
                    <td data-label="Status">
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
                    <td data-label="Action">
                      <button
                        type="button"
                        className="sales-small-action"
                        onClick={() =>
                          setSearchParams((previous) => {
                            const next = new URLSearchParams(previous);
                            next.set("orderId", String(row.id));
                            return next;
                          })
                        }
                      >
                        View / Manage <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            {dialogError && (
              <p role="alert" className="sales-error">
                {dialogError}
              </p>
            )}
            {dialogSuccess && (
              <p role="status" className="sales-success">
                {dialogSuccess}
              </p>
            )}
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
                {Number(details.additionalFee) > 0 && (
                  <div className="sales-totals av-fee-summary">
                    <span>Additional fee · {details.additionalFeeReason}</span>
                    <strong>{money(details.additionalFee)}</strong>
                  </div>
                )}
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
                {mayReschedule && (
                  <div className="av-order-appointment-actions">
                    <div className="av-order-appointment-actions__intro">
                      <CalendarClock size={19} aria-hidden="true" />
                      <div>
                        <strong>Need to change the appointment?</strong>
                        <p>
                          Agree on a new time with the customer first. The saved
                          appointment and any unstarted jobs will move together.
                        </p>
                      </div>
                    </div>
                    <button
                      className="av-order-reschedule-trigger"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRescheduleError("");
                        setRescheduleOpen(true);
                      }}
                    >
                      <CalendarClock size={17} />
                      Reschedule appointment
                    </button>
                  </div>
                )}
                {canApprove &&
                  selected?.channel === "ONLINE" &&
                  fieldWorkStarted && (
                    <div className="av-order-work-notice" role="status">
                      <strong>Field work has already started.</strong>
                      <p>
                        Cancellation and rescheduling are unavailable here.
                        Completed work and stock movements must be preserved.
                      </p>
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
      {rescheduleOpen && details?.schedule && (
        <OrderRescheduleModal
          reference={details.reference}
          currentSchedule={details.schedule}
          busy={busy}
          error={rescheduleError}
          onSave={rescheduleOrder}
          onClose={() => {
            if (!busy) {
              setRescheduleOpen(false);
              setRescheduleError("");
            }
          }}
        />
      )}
    </div>
  );
}
