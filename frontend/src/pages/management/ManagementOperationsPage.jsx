import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import AvailabilityPicker from "../../components/scheduling/AvailabilityPicker";
import TechnicianTeamPicker from "../../components/management/TechnicianTeamPicker";
import SourceTeamPanel from "../../components/management/SourceTeamPanel";
import "../../styles/management/workspace.css";

const labels = {
  SERVICE_ACCEPTED: "Accept request",
  SERVICE_DECLINED: "Decline request",
  SERVICE_SCHEDULED: "Confirm schedule",
  SERVICE_RESCHEDULED: "Reschedule",
  SERVICE_STARTED: "Start service",
  SERVICE_COMPLETED: "Complete service",
  SERVICE_CANCELLED: "Cancel request",
};

function availableActions(record) {
  if (record.status === "PENDING")
    return ["SERVICE_ACCEPTED", "SERVICE_DECLINED"];
  if (record.status === "CONFIRMED") {
    if (record.serviceStarted) return ["SERVICE_COMPLETED"];
    if (record.serviceScheduled)
      return ["SERVICE_RESCHEDULED", "SERVICE_STARTED", "SERVICE_CANCELLED"];
    return ["SERVICE_SCHEDULED", "SERVICE_CANCELLED"];
  }
  return [];
}

function phoneHref(raw) {
  const safe = String(raw || "").replace(/[^\d+]/g, "");
  const digits = safe.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `tel:${safe}` : null;
}

export default function ManagementOperationsPage({ kind = "SERVICE" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [event, setEvent] = useState("");
  const [schedule, setSchedule] = useState("");
  const [note, setNote] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);
  const [sourceJobs, setSourceJobs] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Facebook conversions link directly to this service request ID.
  const selectedId = searchParams.get("requestId");
  const selected = items.find((row) => String(row.id) === selectedId) || null;

  function close() {
    if (busy) return;
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
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get("/api/management/services", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setItems(data.records || []);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load service requests.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selected) return;
    setEvent(availableActions(selected)[0] || "");
    setNote("");
    setTechnicianIds([]);
    setSourceJobs([]);
    setSchedule(selected.schedule || "");
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keyDown(eventValue) {
      if (eventValue.key === "Escape" && !busy) close();
    }
    document.addEventListener("keydown", keyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyDown);
    };
    // The close function depends on the current query state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, busy]);

  const filtered = useMemo(
    () =>
      items.filter((row) =>
        `${row.reference} ${row.customer} ${row.products} ${row.contact} ${row.status}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [items, search],
  );

  async function save(eventSubmit) {
    eventSubmit.preventDefault();
    if (!selected || !event || busy) return;
    const requiresSchedule = [
      "SERVICE_SCHEDULED",
      "SERVICE_RESCHEDULED",
      "SERVICE_ACCEPTED",
    ].includes(event);
    if (requiresSchedule && !schedule) {
      setError("Choose a future appointment date and time.");
      return;
    }
    if (
      ["SERVICE_DECLINED", "SERVICE_CANCELLED", "SERVICE_RESCHEDULED"].includes(
        event,
      ) &&
      note.trim().length < 5
    ) {
      setError("Please enter a reason of at least 5 characters.");
      return;
    }
    if (
      event === "SERVICE_STARTED" &&
      !sourceJobs.some(
        (job) =>
          job.type === "SERVICE" &&
          ["ASSIGNED", "IN_PROGRESS"].includes(job.status) &&
          job.members?.length > 0,
      )
    ) {
      setError("Assign a technician team below before starting this service.");
      return;
    }
    if (!window.confirm(`${labels[event]} for service #${selected.id}?`))
      return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        `/api/management/services/${selected.id}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode: event,
          note: note.trim(),
          schedule: requiresSchedule ? schedule : null,
          technicianIds: event === "SERVICE_ACCEPTED" ? technicianIds : [],
        },
      );
      if (!data.success) throw new Error("Update not confirmed.");
      setNotice(
        event === "SERVICE_ACCEPTED"
          ? `Service #${selected.id} confirmed. Work order created; ${technicianIds.length ? "workers assigned" : "pending technician assignment"}.`
          : `Service #${selected.id}: ${labels[event]} saved.`,
      );
      close();
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update the service request.",
      );
    } finally {
      setBusy(false);
    }
  }

  const callLink = phoneHref(selected?.contact);

  return (
    <div className="wsm-page">
      <header className="wsm-head">
        <div>
          <span className="wsm-kicker">
            <ClipboardList size={16} /> SERVICES
          </span>
          <h1>Service requests</h1>
          <p>
            Manage online bookings and service agreements recorded by staff from
            Facebook Messenger.
          </p>
        </div>
        <button
          type="button"
          className="wsm-secondary"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="wsm-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="wsm-success">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      <section className="wsm-panel">
        <div className="wsm-table-head">
          <h2>{filtered.length} service requests</h2>
          <label className="wsm-search">
            <Search size={17} />
            <input
              aria-label="Search service requests"
              placeholder="Search customer, phone or service"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <p className="wsm-empty" role="status">
            Loading services…
          </p>
        ) : filtered.length === 0 ? (
          <p className="wsm-empty">No matching service requests.</p>
        ) : (
          <div className="wsm-overflow">
            <table className="wsm-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th>Service</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.customer}</td>
                    <td>{row.facebookRequestId ? "Facebook" : "Online"}</td>
                    <td>{row.contact || "Not provided"}</td>
                    <td>{row.products}</td>
                    <td>{row.schedule || "Pending confirmation"}</td>
                    <td>
                      <span className="wsm-status">{row.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="wsm-secondary wsm-row-action"
                        onClick={() => open(row)}
                      >
                        View / Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selectedId && !loading && !selected && (
        <p role="alert" className="wsm-error">
          Service request #{selectedId} isn't in the current results. Refresh or
          check the original request.
        </p>
      )}
      {selected && (
        <div
          className="wsm-backdrop"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-heading"
            className="wsm-dialog"
          >
            <div className="wsm-dialog-head">
              <h2 id="service-detail-heading">Service #{selected.id}</h2>
              <button
                type="button"
                className="wsm-close"
                aria-label="Close service request"
                onClick={close}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </div>
            <div className="wsm-form">
              <p>
                <strong>Customer:</strong> {selected.customer}
              </p>
              <p>
                <strong>Source:</strong>{" "}
                {selected.facebookRequestId
                  ? "Manually entered Facebook Messenger agreement"
                  : "Online booking"}
              </p>
              <p>
                <Phone size={16} aria-hidden="true" />{" "}
                <strong>Contact number:</strong>{" "}
                {callLink ? (
                  <a href={callLink}>{selected.contact}</a>
                ) : (
                  selected.contact || "Not provided"
                )}
              </p>
              <p>
                <MapPin size={16} aria-hidden="true" />{" "}
                <strong>Service address:</strong>{" "}
                {selected.address || "Not provided"}
              </p>
              <p>
                <strong>Requested service:</strong> {selected.products}
              </p>
              <p>
                <CalendarDays size={16} aria-hidden="true" />{" "}
                <strong>Schedule:</strong>{" "}
                {selected.schedule || "Pending confirmation"}
              </p>
              <p>
                <strong>Status:</strong> {selected.status}
              </p>
              {selected.status !== "PENDING" &&
                selected.status !== "CANCELLED" && (
                  <SourceTeamPanel
                    key={`SERVICE-${selected.id}`}
                    kind="SERVICE"
                    sourceId={selected.id}
                    onJobsChange={setSourceJobs}
                  />
                )}
              {availableActions(selected).length ? (
                <form className="wsm-form" onSubmit={save}>
                  <label className="wsm-field">
                    Next action
                    <select
                      value={event}
                      onChange={(changeEvent) =>
                        setEvent(changeEvent.target.value)
                      }
                      required
                    >
                      {availableActions(selected).map((code) => (
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
                      label="Select available service date and time"
                    />
                  )}
                  {event === "SERVICE_ACCEPTED" && (
                    <TechnicianTeamPicker
                      value={technicianIds}
                      onChange={setTechnicianIds}
                      disabled={busy}
                    />
                  )}
                  {event === "SERVICE_STARTED" &&
                    !sourceJobs.some(
                      (job) =>
                        job.type === "SERVICE" &&
                        ["ASSIGNED", "IN_PROGRESS"].includes(job.status) &&
                        job.members?.length > 0,
                    ) && (
                      <p className="wsm-info">
                        Assign the service team above before starting the job.
                      </p>
                    )}
                  <label className="wsm-field">
                    Note / reason
                    <textarea
                      value={note}
                      maxLength={1000}
                      rows={3}
                      onChange={(changeEvent) =>
                        setNote(changeEvent.target.value)
                      }
                    />
                  </label>
                  <div className="wsm-form-actions">
                    <button
                      className="wsm-secondary"
                      type="button"
                      onClick={close}
                      disabled={busy}
                    >
                      Close
                    </button>
                    <button
                      className="wsm-primary"
                      type="submit"
                      disabled={
                        busy ||
                        (event === "SERVICE_STARTED" &&
                          !sourceJobs.some(
                            (job) =>
                              job.type === "SERVICE" &&
                              ["ASSIGNED", "IN_PROGRESS"].includes(
                                job.status,
                              ) &&
                              job.members?.length > 0,
                          ))
                      }
                    >
                      {busy
                        ? "Saving…"
                        : event === "SERVICE_ACCEPTED"
                          ? "Confirm & create work order"
                          : "Confirm update"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="wsm-footnote">
                  No further status actions available for this request.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
