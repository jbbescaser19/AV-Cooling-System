import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import api from "../../../api/api.js";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import { getStaff } from "../../utils/authMock";
import "../../styles/management/sales-live.css";

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
  if (order?.channel !== "ONLINE") return null;
  if (order.status === "PENDING") return ["ORDER_ACCEPTED", "Accept order"];
  if (order.status === "CONFIRMED")
    return ["INSTALLATION_SCHEDULED", "Schedule installation"];
  if (order.status === "SCHEDULED")
    return ["ORDER_OUT_FOR_DELIVERY", "Out for delivery"];
  if (order.status === "IN_PROGRESS") {
    if (!order.delivered) return ["ORDER_DELIVERED", "Mark delivered"];
    if (!order.installationStarted)
      return ["INSTALLATION_STARTED", "Start installation"];
    return ["INSTALLATION_COMPLETED", "Complete installation"];
  }
  return null;
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
  const [schedule, setSchedule] = useState("");
  const [note, setNote] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);
  const [sourceJobs, setSourceJobs] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const modalRef = useRef(null);

  const rawOrderId = searchParams.get("orderId");
  const orderId =
    rawOrderId && /^[1-9]\d*$/.test(rawOrderId) ? Number(rawOrderId) : null;

  function closeDetails() {
    if (busy) return;
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
          setSchedule(data.order?.schedule || "");
          setNote("");
          setTechnicianIds([]);
          setSourceJobs([]);
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

  const filtered = useMemo(
    () =>
      orders.filter(
        (row) =>
          (channel === "ALL" || row.channel === channel) &&
          `${row.reference} ${row.customer} ${row.status} ${row.channel}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [orders, channel, search],
  );

  const listRow = orders.find((item) => Number(item.id) === orderId);
  const selected = details ? { ...listRow, ...details } : listRow;
  const canApprove = ["OWNER", "MANAGER"].includes(getStaff()?.role);
  const action = selected && canApprove ? nextOnlineEvent(selected) : null;
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
    if (
      (eventCode === "INSTALLATION_SCHEDULED" ||
        (eventCode === "ORDER_ACCEPTED" && needsFieldWork)) &&
      !schedule
    ) {
      setError("Please choose an installation date and time.");
      return;
    }
    if (
      ["ORDER_CANCELLED_BY_STAFF", "ORDER_DECLINED"].includes(eventCode) &&
      reason.trim().length < 5
    ) {
      setError("Please enter a reason with at least 5 characters.");
      return;
    }
    const startingType =
      eventCode === "ORDER_OUT_FOR_DELIVERY" &&
      details.fulfillment === "DELIVERY"
        ? "DELIVERY"
        : eventCode === "INSTALLATION_STARTED" &&
            needsFieldWork &&
            details.items?.some((item) =>
              Boolean(Number(item.installationIncluded)),
            )
          ? "INSTALLATION"
          : null;
    if (
      startingType &&
      !sourceJobs.some(
        (job) =>
          job.type === startingType &&
          ["ASSIGNED", "IN_PROGRESS"].includes(job.status) &&
          job.members?.length > 0,
      )
    ) {
      setError(
        `Assign a technician team to ${startingType.toLowerCase()} below before starting work.`,
      );
      return;
    }
    if (!window.confirm(`${label} for ${selected.reference}?`)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(
        `/api/management/orders/${encodeURIComponent(selected.reference)}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode,
          schedule: ["ORDER_ACCEPTED", "INSTALLATION_SCHEDULED"].includes(
            eventCode,
          )
            ? schedule || null
            : null,
          technicianIds: eventCode === "ORDER_ACCEPTED" ? technicianIds : [],
          note: reason.trim(),
        },
      );
      if (!data.success) throw new Error("The order update was not confirmed.");
      setSuccess(
        eventCode === "ORDER_ACCEPTED"
          ? `Order confirmed. ${data.workOrders?.length || 0} job(s) created.${technicianIds.length ? " Team assigned." : " You can assign the team from this order page before work starts."}`
          : `${label} recorded for ${selected.reference}.`,
      );
      closeDetails();
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
    <div className="sales-ui">
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
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.reference}</strong>
                    </td>
                    <td>{row.customer}</td>
                    <td>{row.channel}</td>
                    <td>
                      <span
                        className={`sales-pill is-${String(row.status).toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`sales-pill is-${String(row.paymentStatus).toLowerCase()}`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <strong>{money(row.total)}</strong>
                    </td>
                    <td>{showDate(row.createdAt)}</td>
                    <td>
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
            className="sales-panel sales-modal"
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
                      onJobsChange={setSourceJobs}
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
                  <div className="sales-step">
                    <h3>Next step: {action[1]}</h3>
                    {["ORDER_ACCEPTED", "INSTALLATION_SCHEDULED"].includes(
                      action[0],
                    ) &&
                      needsFieldWork && (
                        <AvailabilityPicker
                          value={schedule}
                          onChange={setSchedule}
                          disabled={busy}
                          allowExistingValue
                          label="Select an available installation appointment"
                        />
                      )}
                    {action[0] === "ORDER_ACCEPTED" && needsFieldWork && (
                      <TechnicianTeamPicker
                        value={technicianIds}
                        onChange={setTechnicianIds}
                        disabled={busy}
                      />
                    )}
                    {action &&
                      [
                        "ORDER_OUT_FOR_DELIVERY",
                        "INSTALLATION_STARTED",
                      ].includes(action[0]) &&
                      needsFieldWork &&
                      !sourceJobs.length && (
                        <p className="sales-note">
                          Assign the technician team above before starting field
                          work.
                        </p>
                      )}
                    <button
                      className="sales-primary"
                      type="button"
                      disabled={
                        busy ||
                        (action[0] === "ORDER_OUT_FOR_DELIVERY" &&
                          details.fulfillment === "DELIVERY" &&
                          !sourceJobs.some(
                            (job) =>
                              job.type === "DELIVERY" &&
                              ["ASSIGNED", "IN_PROGRESS"].includes(
                                job.status,
                              ) &&
                              job.members?.length,
                          )) ||
                        (action[0] === "INSTALLATION_STARTED" &&
                          details.items?.some((item) =>
                            Boolean(Number(item.installationIncluded)),
                          ) &&
                          !sourceJobs.some(
                            (job) =>
                              job.type === "INSTALLATION" &&
                              ["ASSIGNED", "IN_PROGRESS"].includes(
                                job.status,
                              ) &&
                              job.members?.length,
                          ))
                      }
                      onClick={() => apply(action[0], action[1])}
                    >
                      {busy
                        ? "Saving…"
                        : action[0] === "ORDER_ACCEPTED"
                          ? "Confirm & create work orders"
                          : action[1]}
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
