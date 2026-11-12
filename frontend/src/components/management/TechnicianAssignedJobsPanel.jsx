import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Play,
  RefreshCw,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import ServiceActivityHistory from "./ServiceActivityHistory.jsx";

import "../../styles/management/technician-jobs.css";
import "../../styles/management/combined-technician-jobs.css";

function groupAssignedJobs(rows) {
  const groups = new Map();
  for (const job of rows) {
    const isOrder =
      job.orderId && ["DELIVERY", "INSTALLATION"].includes(job.workType);
    const key = isOrder ? `order-${job.orderId}` : `job-${job.id}`;
    if (!groups.has(key)) groups.set(key, { key, jobs: [] });
    if (
      !groups.get(key).jobs.some((known) => String(known.id) === String(job.id))
    ) {
      groups.get(key).jobs.push(job);
    }
  }
  const rank = (group) => {
    const statuses = group.jobs.map((job) => job.status);
    if (statuses.includes("IN_PROGRESS")) return 0;
    if (statuses.includes("ASSIGNED")) return 1;
    if (statuses.includes("PENDING")) return 2;
    if (statuses.every((value) => value === "COMPLETED")) return 4;
    return 3;
  };
  return [...groups.values()].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Math.max(...b.jobs.map((job) => Number(job.id))) -
        Math.max(...a.jobs.map((job) => Number(job.id))),
  );
}

function getProgress(group) {
  const delivery = group.jobs.find((job) => job.workType === "DELIVERY");
  const installation = group.jobs.find(
    (job) => job.workType === "INSTALLATION",
  );
  const first = group.jobs[0];
  const isOrder = Boolean(first.orderId);

  // The API can return only some linked work orders to a technician.
  // Use server-side evidence of installation rather than guessing from visible rows.
  const hasInstallation =
    isOrder &&
    (Boolean(installation) ||
      group.jobs.some((job) => Number(job.hasInstallationJob) === 1));
  const isService = !isOrder || hasInstallation;

  const deliveryStatus = delivery?.status || first.deliveryStatus || null;
  const installationStatus =
    installation?.status || first.installationStatus || null;
  const statuses = isOrder
    ? hasInstallation
      ? [deliveryStatus, installationStatus].filter(Boolean)
      : [deliveryStatus || first.status]
    : group.jobs.map((job) => job.status);

  const completed =
    statuses.length > 0 && statuses.every((value) => value === "COMPLETED");
  const aligned =
    statuses.length > 0 && statuses.every((value) => value === statuses[0]);
  const status = completed
    ? "COMPLETED"
    : aligned
      ? statuses[0]
      : "NEEDS_REVIEW";
  const verb = isService ? "Service" : "Delivery";
  const action =
    status === "ASSIGNED"
      ? `START_${verb.toUpperCase()}`
      : status === "IN_PROGRESS"
        ? `COMPLETE_${verb.toUpperCase()}`
        : null;

  return {
    delivery,
    installation,
    isOrder,
    isService,
    hasInstallation,
    status,
    completed,
    action,
    verb,
  };
}

function wallClock(value) {
  if (!value) return "No appointment set";
  return `${String(value).replace("T", " at ").slice(0, 16)} (PH time)`;
}

export default function TechnicianAssignedJobsPanel({ limit = null }) {
  const isTechnician = getStaff()?.role === "TECHNICIAN";
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [completingKey, setCompletingKey] = useState(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!isTechnician) return undefined;
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/management/workspace/work-orders", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setJobs(Array.isArray(data.items) ? data.items : []);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load assigned work.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isTechnician, revision]);

  useEffect(() => {
    if (!isTechnician) return undefined;
    const reload = () => setRevision((value) => value + 1);
    const whenVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const interval = window.setInterval(whenVisible, 60000);
    window.addEventListener("focus", whenVisible);
    window.addEventListener("av-management-updated", reload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", whenVisible);
      window.removeEventListener("av-management-updated", reload);
    };
  }, [isTechnician]);

  const groups = useMemo(() => groupAssignedJobs(jobs), [jobs]);
  const visible =
    Number.isInteger(limit) && limit > 0 ? groups.slice(0, limit) : groups;
  const activeCount = groups.filter((group) =>
    group.jobs.some((job) => ["ASSIGNED", "IN_PROGRESS"].includes(job.status)),
  ).length;

  async function performAction(group, action, notes = "") {
    if (busyKey !== null || !action) return;
    if (action.startsWith("COMPLETE_") && notes.trim().length < 5) {
      setError("Enter a completion summary of at least 5 characters.");
      return;
    }
    if (
      action.startsWith("START_") &&
      !window.confirm(
        `Start ${action.endsWith("SERVICE") ? "service" : "delivery"} for this customer?`,
      )
    ) {
      return;
    }
    const primary = group.jobs[0];
    setBusyKey(group.key);
    setError("");
    setNotice("");
    try {
      if (primary.orderId) {
        const { data } = await api.patch(
          `/api/management/workspace/technician-order-progress/${encodeURIComponent(primary.orderId)}`,
          { action, notes: notes.trim() },
        );
        if (!data.success)
          throw new Error(data.message || "The update was not saved.");
      } else {
        const status = action.startsWith("START_")
          ? "IN_PROGRESS"
          : "COMPLETED";
        const { data } = await api.patch(
          `/api/management/workspace/work-orders/${encodeURIComponent(primary.id)}`,
          {
            status,
            notes: notes.trim(),
            technicianId: null,
            technicianIds: [],
            scheduledStart: null,
          },
        );
        if (!data.success)
          throw new Error(data.message || "The update was not saved.");
      }
      setNotice(`${action.replaceAll("_", " ")} saved successfully.`);
      setCompletingKey(null);
      setCompletionNotes("");
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update the job.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (!isTechnician) return null;

  return (
    <section
      className="technician-jobs av-technician-work"
      aria-label="My assigned jobs"
    >
      <div className="av-technician-work__heading">
        <div>
          <span className="technician-jobs__eyebrow">
            <Wrench size={15} /> MY JOBS
          </span>
          <h2>Assigned work</h2>
          <p>
            Call the customer before the visit. Start work when your team begins
            on-site.
          </p>
        </div>
        <div className="av-technician-work__heading-actions">
          <span className="technician-jobs__count">{activeCount} active</span>
          <button
            type="button"
            className="wsm-secondary"
            disabled={loading || busyKey !== null}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="wsm-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="wsm-success" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="av-technician-work__empty" role="status">
          Loading your assigned jobs…
        </p>
      ) : visible.length === 0 ? (
        <p className="av-technician-work__empty">
          No jobs assigned to you yet.
        </p>
      ) : (
        <div className="av-technician-work__list">
          {visible.map((group) => {
            const primary = group.jobs[0];
            const progress = getProgress(group);
            const { action, status, isService } = progress;
            const isCompleting = completingKey === group.key;
            const combined = progress.hasInstallation;
            const typeLabel = primary.serviceRequestId
              ? "Service request"
              : combined
                ? "Delivery & Installation"
                : "Delivery only";
            const title = primary.serviceRequestId
              ? `Service #${primary.serviceRequestId}`
              : `Order #${primary.orderId}`;
            const startLabel = isService ? "Start Service" : "Start Delivery";
            const finishLabel = isService
              ? "Complete Service"
              : "Complete Delivery";
            return (
              <article className="av-job-card" key={group.key}>
                <div className="av-job-card__main">
                  <div className="av-job-card__topline">
                    <span className="av-job-card__type">
                      {isService ? <Wrench size={16} /> : <Truck size={16} />}
                      {typeLabel}
                    </span>
                    <span
                      className={`av-job-card__status is-${status.toLowerCase()}`}
                    >
                      {status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h3>{title}</h3>
                  <p className="av-job-card__customer">
                    {primary.customer || "Customer name unavailable"}
                  </p>
                  <div className="av-job-card__details">
                    <div>
                      <CalendarDays size={16} />
                      <span>{wallClock(primary.scheduledStart)}</span>
                    </div>
                    {primary.phone && (
                      <a
                        href={`tel:${String(primary.phone).replace(/[^\d+]/g, "")}`}
                      >
                        <Phone size={16} />
                        {primary.phone}
                      </a>
                    )}
                    {primary.address && (
                      <div>
                        <MapPin size={16} />
                        <span>{primary.address}</span>
                      </div>
                    )}
                    {primary.destinationAddress && (
                      <div>
                        <MapPin size={16} />
                        <span>
                          Destination / installation:{" "}
                          {primary.destinationAddress}
                        </span>
                      </div>
                    )}
                    {primary.teamLeader && (
                      <div>
                        <Users size={16} />
                        <span>
                          Team {primary.teamLeader}
                          {primary.teamMembers
                            ? ` · ${primary.teamMembers}`
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  {combined && (
                    <p className="av-job-card__workflow-note">
                      <Wrench size={16} aria-hidden="true" />
                      The same team handles delivery and installation. Use Start
                      Service when work begins, then Complete Service when
                      everything is done.
                    </p>
                  )}
                </div>

                <div className="av-job-card__action-panel">
                  <span className="av-job-card__action-caption">
                    NEXT ACTION
                  </span>
                  {action && !isCompleting && (
                    <button
                      type="button"
                      className="wsm-primary av-job-card__primary"
                      disabled={busyKey !== null}
                      onClick={() =>
                        action.startsWith("START_")
                          ? performAction(group, action)
                          : (setCompletingKey(group.key),
                            setCompletionNotes(""),
                            setError(""))
                      }
                    >
                      {action.startsWith("START_") ? (
                        <Play size={17} />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      {busyKey === group.key
                        ? "Saving…"
                        : action.startsWith("START_")
                          ? startLabel
                          : finishLabel}
                    </button>
                  )}
                  {isCompleting && (
                    <span className="av-job-card__action-help">
                      Complete the summary below before confirming.
                    </span>
                  )}
                  {status === "COMPLETED" && (
                    <div className="av-job-card__finished">
                      <CheckCircle2 size={19} /> Job completed
                    </div>
                  )}
                  {status === "PENDING" && (
                    <div className="av-job-card__hint">
                      Waiting for Management to assign the team.
                    </div>
                  )}
                  {status === "NEEDS_REVIEW" && (
                    <div className="av-job-card__hint">
                      Linked job stages have different statuses. Ask a Manager
                      to review them.
                    </div>
                  )}
                  <Link
                    className="av-job-card__calendar"
                    to="/management/booking-calendar"
                  >
                    <Clock3 size={16} /> View calendar
                  </Link>
                </div>

                {primary.serviceRequestId && (
                  <div className="av-job-card__extras">
                    <button
                      type="button"
                      className="wsm-secondary"
                      onClick={() =>
                        setExpandedKey((key) =>
                          key === group.key ? null : group.key,
                        )
                      }
                    >
                      {expandedKey === group.key
                        ? "Hide service notes"
                        : "View service history and staff notes"}
                    </button>
                    {expandedKey === group.key && (
                      <ServiceActivityHistory
                        requestId={primary.serviceRequestId}
                      />
                    )}
                  </div>
                )}

                {isCompleting && action && (
                  <form
                    className="av-job-card__completion"
                    onSubmit={(event) => {
                      event.preventDefault();
                      performAction(group, action, completionNotes);
                    }}
                  >
                    <label htmlFor={`av-completion-${group.key}`}>
                      Completion summary <span>(required)</span>
                    </label>
                    <textarea
                      id={`av-completion-${group.key}`}
                      required
                      minLength={5}
                      maxLength={1000}
                      rows={3}
                      value={completionNotes}
                      disabled={busyKey !== null}
                      placeholder="Describe the work completed and any findings."
                      onChange={(event) =>
                        setCompletionNotes(event.target.value)
                      }
                    />
                    <div className="av-job-card__completion-actions">
                      <button
                        className="wsm-secondary"
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => setCompletingKey(null)}
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        className="wsm-primary"
                        type="submit"
                        disabled={
                          busyKey !== null || completionNotes.trim().length < 5
                        }
                      >
                        <CheckCircle2 size={16} />{" "}
                        {busyKey === group.key
                          ? "Saving…"
                          : "Confirm completion"}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}

      {limit && groups.length > limit && (
        <p className="technician-jobs__more">
          <Link to="/management/schedules">
            View all assigned work in Schedules
          </Link>
        </p>
      )}
    </section>
  );
}
