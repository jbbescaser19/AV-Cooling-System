import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";
import { getStaff } from "../../utils/authMock.js";
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import ServiceActivityHistory from "../../components/management/ServiceActivityHistory.jsx";
import ServicePaymentPanel from "../../components/management/ServicePaymentPanel.jsx";
import ActionGuidance from "../../components/common/ActionGuidance.jsx";
import "../../styles/management/workspace.css";
import "../../styles/management/sales-live.css";
import "../../styles/management/av-records.css";
import "../../styles/management/record-pagination.css";
import "../../styles/management/service-request-dialog.css";

const labels = {
  SERVICE_ACCEPTED: "Accept & confirm appointment",
  SERVICE_DECLINED: "Decline request",
  SERVICE_SCHEDULED: "Confirm schedule",
  SERVICE_RESCHEDULED: "Reschedule",
  SERVICE_STARTED: "Start service",
  SERVICE_COMPLETED: "Complete service",
  SERVICE_CANCELLED: "Cancel request",
};

function availableActions(record, role) {
  if (role === "SALES_CASHIER") {
    if (record.status === "PENDING") return ["SERVICE_ACCEPTED"];
    if (record.status === "CONFIRMED" && !record.serviceStarted) {
      return record.schedule ? ["SERVICE_RESCHEDULED"] : ["SERVICE_SCHEDULED"];
    }
    return [];
  }
  if (record.status === "PENDING")
    return ["SERVICE_ACCEPTED", "SERVICE_DECLINED"];
  if (record.status === "CONFIRMED") {
    if (record.serviceStarted) return ["SERVICE_COMPLETED"];
    return record.schedule
      ? ["SERVICE_RESCHEDULED", "SERVICE_STARTED", "SERVICE_CANCELLED"]
      : ["SERVICE_SCHEDULED", "SERVICE_CANCELLED"];
  }
  return [];
}

function phoneHref(raw) {
  const safe = String(raw || "").replace(/[^\d+]/g, "");
  const digits = safe.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `tel:${safe}` : null;
}

export default function ManagementOperationsPage({ kind = "SERVICE" }) {
  const staff = getStaff();
  const canAssign = ["OWNER", "MANAGER"].includes(staff?.role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [event, setEvent] = useState("");
  const [schedule, setSchedule] = useState("");
  const [originalSchedule, setOriginalSchedule] = useState("");
  const [customerReason, setCustomerReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);
  const [sourceJobs, setSourceJobs] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("requestId");
  const selected = items.find((row) => String(row.id) === selectedId) || null;
  const actions = selected ? availableActions(selected, staff?.role) : [];
  const hasAssignedTeam = sourceJobs.some(
    (job) =>
      job.type === "SERVICE" &&
      ["ASSIGNED", "IN_PROGRESS"].includes(job.status) &&
      job.members?.length > 0,
  );

  // Use exactly these conditions for both the disabled button and the guide.
  // POS walk-in services may already be CONFIRMED, PAID and have a team.
  const actionReasons =
    selected && event
      ? [
          [
            "SERVICE_ACCEPTED",
            "SERVICE_SCHEDULED",
            "SERVICE_RESCHEDULED",
          ].includes(event) && !schedule
            ? "Choose an available future appointment date and time."
            : null,
          event === "SERVICE_ACCEPTED" && technicianIds.length === 0
            ? "Choose the technician team before confirming the appointment."
            : null,
          event === "SERVICE_RESCHEDULED" &&
          schedule &&
          schedule === originalSchedule
            ? "Choose a different appointment time from the current schedule."
            : null,
          [
            "SERVICE_DECLINED",
            "SERVICE_CANCELLED",
            "SERVICE_RESCHEDULED",
          ].includes(event) && customerReason.trim().length < 5
            ? "Enter a customer-visible reason (at least 5 characters)."
            : null,
          event === "SERVICE_CANCELLED" && selected.paymentStatus === "PAID"
            ? "This service is paid. First return the funds and record the completed cash refund in Payment details above."
            : null,
          event === "SERVICE_STARTED" && !hasAssignedTeam
            ? "An assigned technician team is required before starting service."
            : null,
          event === "SERVICE_STARTED" && !selected.schedule
            ? "A confirmed service appointment is required before starting."
            : null,
          ["SERVICE_STARTED", "SERVICE_COMPLETED"].includes(event) &&
          internalNote.trim().length < 10
            ? "Write who reported the work and how it was confirmed in the private staff note (10+ characters)."
            : null,
        ].filter(Boolean)
      : [];

  function close(force = false) {
    if (busy && !force) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("requestId");
      return next;
    });
  }
  function open(record) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("requestId", String(record.id));
      return next;
    });
  }

  useEffect(() => {
    const refreshList = () => setRevision((value) => value + 1);
    window.addEventListener("av-management-updated", refreshList);
    return () =>
      window.removeEventListener("av-management-updated", refreshList);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get("/api/management/services", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setItems(Array.isArray(data.records) ? data.records : []);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(
            requestError.response?.data?.message ||
              "Unable to load service requests.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selected) return;
    setEvent(availableActions(selected, staff?.role)[0] || "");
    setSchedule(selected.schedule || "");
    setOriginalSchedule(selected.schedule || "");
    setCustomerReason("");
    setInternalNote("");
    setTechnicianIds([]);
    setSourceJobs([]);
    setActionError("");
  }, [selected?.id, staff?.role]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (ev) => {
      if (ev.key === "Escape" && !busy) close();
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, busy]);

  const filtered = useMemo(
    () =>
      items.filter(
        (row) =>
          (statusFilter === "ALL" || row.status === statusFilter) &&
          `${row.reference} ${row.customer} ${row.products} ${row.contact} ${row.status} ${row.paymentStatus || ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [items, search, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 16));
  const pageItems = filtered.slice((page - 1) * 16, page * 16);

  async function save(submitEvent) {
    submitEvent.preventDefault();
    if (!selected || !event || busy || !actions.includes(event)) return;
    const needsSchedule = [
      "SERVICE_ACCEPTED",
      "SERVICE_SCHEDULED",
      "SERVICE_RESCHEDULED",
    ].includes(event);
    const needsReason = [
      "SERVICE_DECLINED",
      "SERVICE_CANCELLED",
      "SERVICE_RESCHEDULED",
    ].includes(event);
    if (needsSchedule && !schedule) {
      setActionError("Choose a future appointment date and time.");
      return;
    }
    if (needsReason && customerReason.trim().length < 5) {
      setActionError(
        "Enter a customer-visible reason (at least 5 characters).",
      );
      return;
    }
    if (event === "SERVICE_ACCEPTED" && technicianIds.length === 0) {
      setActionError(
        "Select a technician team before confirming this service.",
      );
      return;
    }
    if (
      ["SERVICE_STARTED", "SERVICE_COMPLETED"].includes(event) &&
      internalNote.trim().length < 10
    ) {
      setActionError(
        "For start or completion, enter who reported the work and how it was confirmed (10+ characters) in the private staff note.",
      );
      return;
    }
    if (event === "SERVICE_STARTED" && !hasAssignedTeam) {
      setActionError("Assign a technician team before starting this service.");
      return;
    }
    if (actionReasons.length > 0) {
      setActionError(actionReasons[0]);
      return;
    }
    if (
      ["SERVICE_DECLINED", "SERVICE_CANCELLED", "SERVICE_COMPLETED"].includes(
        event,
      ) &&
      !(await confirmAction({
        title: labels[event],
        message: `${labels[event]} for service #${selected.id}?${customerReason.trim() ? `\nCustomer-visible reason: ${customerReason.trim()}` : ""}`,
        confirmText: labels[event],
        danger: ["SERVICE_DECLINED", "SERVICE_CANCELLED"].includes(event),
      }))
    )
      return;

    setBusy(true);
    setActionError("");
    try {
      const { data } = await api.post(
        `/api/management/services/${selected.id}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode: event,
          note: customerReason.trim(), // visible to customer; existing API field
          internalNote: internalNote.trim(), // never sent to customer
          schedule: needsSchedule ? schedule : null,
          technicianIds:
            event === "SERVICE_ACCEPTED" && canAssign ? technicianIds : [],
        },
      );
      if (!data.success) throw new Error("Update not confirmed.");
      setNotice(
        `Service #${selected.id}: ${labels[event]} recorded by ${staff?.name || "staff"}.`,
      );
      close(true);
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message ||
          "Could not update the service request.",
      );
    } finally {
      setBusy(false);
    }
  }

  const callLink = phoneHref(selected?.contact);
  return (
    <div className="wsm-page av-records-responsive av-services-page">
      <header className="wsm-head">
        <div>
          <span className="wsm-kicker">
            <ClipboardList size={16} /> SERVICES
          </span>
          <h1>Service requests</h1>
          <p>Manage online, POS walk-in and Facebook service requests.</p>
        </div>
        <button
          type="button"
          className="wsm-secondary"
          onClick={() => setRevision((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {error && (
        <p className="wsm-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div role="status" className="wsm-success service-action-toast">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss confirmation"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <section className="sales-panel" aria-label="Service request records">
        <div className="sales-section-head">
          <h2>Service request records</h2>
          <span>
            {filtered.length} matching · page {page} of {totalPages}
          </span>
        </div>
        <div className="sales-filters">
          <label className="sales-search">
            <Search size={17} />
            <input
              aria-label="Search service requests"
              placeholder="Search requests, contacts, or payments"
              value={search}
              onChange={(ev) => {
                setSearch(ev.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter service status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All statuses</option>
            {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map(
              (status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </div>
        {loading ? (
          <p role="status" className="sales-empty">
            Loading services…
          </p>
        ) : filtered.length === 0 ? (
          <p className="sales-empty">No matching service requests.</p>
        ) : (
          <div className="sales-table-scroll">
            <table className="sales-table av-smart-table">
              <thead>
                <tr>
                  <th data-mobile="primary">Request</th>
                  <th data-mobile="secondary">Customer</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th data-mobile="status">Status</th>
                  <th>Payment</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Schedule</th>
                  <th data-mobile="action">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Request" data-mobile="primary">
                      <strong>#{row.reference || row.id}</strong>
                    </td>
                    <td data-label="Customer" data-mobile="secondary">
                      {row.customer}
                    </td>
                    <td data-label="Source">
                      {row.facebookRequestId
                        ? "Facebook"
                        : String(row.customerNotes || "").includes(
                              "Walk-in service booked at POS",
                            )
                          ? "Walk-in POS"
                          : "Online"}
                    </td>
                    <td data-label="Contact">
                      {phoneHref(row.contact) ? (
                        <a href={phoneHref(row.contact)}>{row.contact}</a>
                      ) : (
                        row.contact || "Not provided"
                      )}
                    </td>
                    <td data-label="Status" data-mobile="status">
                      <span
                        className={`sales-pill is-${String(row.status || "unknown").toLowerCase()}`}
                      >
                        {String(row.status || "Unknown").replaceAll("_", " ")}
                      </span>
                    </td>
                    <td data-label="Payment">
                      <span
                        className={`sales-pill is-${String(row.paymentStatus || "no-record").toLowerCase()}`}
                      >
                        {row.paymentStatus === "NO_RECORD" || !row.paymentStatus
                          ? "Not recorded"
                          : String(row.paymentStatus).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td data-label="Service">{row.products || "—"}</td>
                    <td data-label="Total">
                      <strong>
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(Number(row.total) || 0)}
                      </strong>
                    </td>
                    <td data-label="Schedule">
                      {row.schedule
                        ? String(row.schedule).replace("T", " at ")
                        : "Not scheduled"}
                    </td>
                    <td data-label="Action" data-mobile="action">
                      <button
                        type="button"
                        className="sales-small-action av-smart-view"
                        aria-label={`View and manage service request ${row.reference || row.id}`}
                        onClick={() => open(row)}
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
        {!loading && filtered.length > 0 && (
          <nav
            className="av-management-pages"
            aria-label="Service request pages"
          >
            <span>
              Showing {(page - 1) * 16 + 1}–
              {Math.min(page * 16, filtered.length)} of {filtered.length}
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
                {page} / {totalPages}
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

      {selectedId && !loading && !selected && (
        <p role="alert" className="wsm-error">
          Service request #{selectedId} was not found in the current list.
        </p>
      )}
      {selected &&
        createPortal(
          <div
            className="wsm-backdrop service-request-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-detail-heading"
              className="wsm-dialog service-request-dialog"
            >
              <div className="wsm-dialog-head">
                <h2 id="service-detail-heading">Service #{selected.id}</h2>
                <button
                  type="button"
                  className="wsm-close"
                  aria-label="Close service request"
                  onClick={() => close()}
                  disabled={busy}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="wsm-form service-request-scroll">
                <p>
                  <strong>Customer:</strong> {selected.customer}
                </p>
                <p>
                  <strong>Source:</strong>{" "}
                  {selected.facebookRequestId
                    ? "Facebook Messenger"
                    : selected.customerNotes?.includes(
                          "Walk-in service booked at POS",
                        )
                      ? "POS walk-in"
                      : "Online booking"}
                </p>
                <p>
                  <Phone size={16} aria-hidden="true" />{" "}
                  <strong>Contact:</strong>{" "}
                  {callLink ? (
                    <a href={callLink}>{selected.contact}</a>
                  ) : (
                    selected.contact || "Not provided"
                  )}
                </p>
                <p>
                  <MapPin size={16} aria-hidden="true" />{" "}
                  <strong>Address:</strong> {selected.address || "Not provided"}
                </p>
                <p>
                  <strong>Requested service:</strong> {selected.products}
                </p>
                <div className="service-request-context">
                  <div>
                    <strong>Customer concern</strong>
                    <p>{selected.concern?.trim() || "No concern provided."}</p>
                  </div>
                  <div>
                    <strong>Customer notes</strong>
                    <p>
                      {selected.customerNotes?.trim() || "No additional notes."}
                    </p>
                  </div>
                  {selected.destinationAddress && (
                    <div>
                      <strong>Relocation destination</strong>
                      <p>{selected.destinationAddress}</p>
                    </div>
                  )}
                </div>
                <p>
                  <CalendarDays size={16} aria-hidden="true" />{" "}
                  <strong>Schedule:</strong>{" "}
                  {selected.schedule || "Pending confirmation"}
                </p>
                <div className="av-service-status-pair">
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`sales-pill is-${String(selected.status).toLowerCase()}`}
                    >
                      {selected.status}
                    </span>
                  </p>
                  <p>
                    <strong>Payment:</strong>{" "}
                    <span
                      className={`sales-pill is-${String(selected.paymentStatus || "no-record").toLowerCase()}`}
                    >
                      {!selected.paymentStatus ||
                      selected.paymentStatus === "NO_RECORD"
                        ? "Not recorded"
                        : selected.paymentStatus}
                    </span>
                  </p>
                </div>
                <ServicePaymentPanel
                  requestId={selected.id}
                  refreshKey={revision}
                />
                {canAssign &&
                  selected.status !== "PENDING" &&
                  selected.status !== "CANCELLED" && (
                    <SourceTeamPanel
                      key={`SERVICE-${selected.id}`}
                      kind="SERVICE"
                      sourceId={selected.id}
                      onJobsChange={setSourceJobs}
                    />
                  )}
                {actions.length > 0 ? (
                  <form
                    id="service-request-action-form"
                    className="wsm-form service-request-action-form"
                    onSubmit={save}
                  >
                    <label className="wsm-field">
                      Next action
                      <select
                        value={event}
                        onChange={(e) => {
                          setEvent(e.target.value);
                          setActionError("");
                        }}
                        required
                      >
                        {actions.map((code) => (
                          <option value={code} key={code}>
                            {labels[code]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {[
                      "SERVICE_ACCEPTED",
                      "SERVICE_SCHEDULED",
                      "SERVICE_RESCHEDULED",
                    ].includes(event) && (
                      <AvailabilityPicker
                        value={schedule}
                        onChange={setSchedule}
                        disabled={busy}
                        allowExistingValue
                        existingValue={originalSchedule}
                        label="Select available service date and time"
                      />
                    )}
                    {event === "SERVICE_ACCEPTED" && canAssign && (
                      <TechnicianTeamPicker
                        value={technicianIds}
                        onChange={setTechnicianIds}
                        disabled={busy}
                      />
                    )}
                    {event === "SERVICE_STARTED" && !hasAssignedTeam && (
                      <p className="wsm-info">
                        Assign the service team before starting the job.
                      </p>
                    )}
                    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
                      <label className="wsm-field">
                        Customer-visible reason{" "}
                        {[
                          "SERVICE_DECLINED",
                          "SERVICE_CANCELLED",
                          "SERVICE_RESCHEDULED",
                        ].includes(event)
                          ? "(required)"
                          : "(optional)"}
                        <textarea
                          maxLength={1000}
                          rows={2}
                          value={customerReason}
                          onChange={(e) => setCustomerReason(e.target.value)}
                          placeholder="Reason the customer can see in notifications and service history"
                        />
                        <small>
                          This reason is shared with the customer. Do not write
                          private staff information here.
                        </small>
                      </label>
                      <label className="wsm-field">
                        Internal staff note{" "}
                        {["SERVICE_STARTED", "SERVICE_COMPLETED"].includes(
                          event,
                        )
                          ? "(required for work progress)"
                          : "(optional)"}
                        <textarea
                          maxLength={1000}
                          rows={3}
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                          placeholder="For store staff and assigned technicians only"
                        />
                        <small>
                          Private. Not included in customer notifications or
                          customer history.
                        </small>
                      </label>
                    </div>
                    <ActionGuidance
                      title="To confirm this update"
                      reasons={actionReasons}
                      readyText="Ready to confirm this service update."
                    />
                    {actionError && (
                      <p className="wsm-error" role="alert">
                        {actionError}
                      </p>
                    )}
                  </form>
                ) : (
                  <p className="wsm-footnote">
                    No further status actions available for your staff role.
                  </p>
                )}
                <ServiceActivityHistory requestId={selected.id} />
              </div>
              <footer className="service-request-footer">
                <button
                  className="wsm-secondary"
                  type="button"
                  onClick={() => close()}
                  disabled={busy}
                >
                  Close
                </button>
                {actions.length > 0 && (
                  <button
                    className="wsm-primary"
                    type="submit"
                    form="service-request-action-form"
                    disabled={busy || actionReasons.length > 0}
                  >
                    {busy
                      ? "Saving…"
                      : event === "SERVICE_ACCEPTED"
                        ? "Accept request & confirm schedule"
                        : "Confirm update"}
                  </button>
                )}
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
