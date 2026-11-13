import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Eye,
  Filter,
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
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import { getStaff } from "../../utils/authMock.js";
import ServiceActivityHistory from "./ServiceActivityHistory.jsx";

import "../../styles/management/technician-jobs.css";
import "../../styles/management/combined-technician-jobs.css";
import "../../styles/management/technician-job-detail-modal.css";

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

function jobCategory(group) {
  const progress = getProgress(group);
  if (group.jobs.some((job) => Boolean(job.serviceRequestId))) return "SERVICE";
  if (progress.hasInstallation) return "INSTALLATION";
  return "DELIVERY";
}

function statusCategory(group) {
  const status = getProgress(group).status;
  if (["ASSIGNED", "PENDING"].includes(status)) return "PENDING";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  return "NEEDS_REVIEW";
}

const statusTabs = [
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "NEEDS_REVIEW", label: "Review" },
  { key: "ALL", label: "All" },
];
const typeTabs = [
  { key: "ALL", label: "All jobs" },
  { key: "SERVICE", label: "Services" },
  { key: "INSTALLATION", label: "Installations" },
  { key: "DELIVERY", label: "Delivery" },
];

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
  const [detailGroup, setDetailGroup] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const hasLoadedRef = useRef(false);

  useRealtimeRefresh(["jobs", "schedules", "orders", "services"], setRevision);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isTechnician) return undefined;
    const controller = new AbortController();
    if (!hasLoadedRef.current) setLoading(true);
    api
      .get("/api/management/workspace/work-orders", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setJobs(Array.isArray(data.items) ? data.items : []);
          hasLoadedRef.current = true;
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
    window.addEventListener("av-management-updated", reload);
    return () => {
      window.removeEventListener("av-management-updated", reload);
    };
  }, [isTechnician]);

  useEffect(() => {
    if (!detailGroup) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDetailGroup(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailGroup]);

  const groups = useMemo(() => groupAssignedJobs(jobs), [jobs]);
  const counts = useMemo(() => {
    const next = {
      ALL: groups.length,
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      NEEDS_REVIEW: 0,
    };
    for (const group of groups) next[statusCategory(group)] += 1;
    return next;
  }, [groups]);
  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          (statusFilter === "ALL" || statusCategory(group) === statusFilter) &&
          (typeFilter === "ALL" || jobCategory(group) === typeFilter),
      ),
    [groups, statusFilter, typeFilter],
  );
  const previewLimit = Number.isInteger(limit) && limit > 0 ? limit : null;
  const pageSize = previewLimit || 12;
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = previewLimit
    ? filteredGroups.slice(0, pageSize)
    : filteredGroups.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeCount = counts.PENDING + counts.IN_PROGRESS;

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

      <div className="av-tech-filters" aria-label="Filter my assigned work">
        <div className="av-tech-filters__title">
          <Filter size={15} /> Filter by progress
        </div>
        <div
          className="av-tech-filter-row"
          role="group"
          aria-label="Job status"
        >
          {statusTabs
            .filter(
              (tab) => tab.key !== "NEEDS_REVIEW" || counts.NEEDS_REVIEW > 0,
            )
            .map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`av-tech-filter ${statusFilter === tab.key ? "is-active" : ""}`}
                aria-pressed={statusFilter === tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setPage(1);
                  setCompletingKey(null);
                }}
              >
                <span>{tab.label}</span>
                <small>{counts[tab.key]}</small>
              </button>
            ))}
        </div>
        <div
          className="av-tech-filter-row av-tech-filter-row--type"
          role="group"
          aria-label="Job type"
        >
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`av-tech-filter av-tech-filter--type ${typeFilter === tab.key ? "is-active" : ""}`}
              aria-pressed={typeFilter === tab.key}
              onClick={() => {
                setTypeFilter(tab.key);
                setPage(1);
                setCompletingKey(null);
              }}
            >
              {tab.label}
            </button>
          ))}
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
        <div className="av-technician-work__empty">
          <strong>No matching jobs</strong>
          <p>
            {groups.length
              ? "Try another status or job type."
              : "No jobs assigned to you yet."}
          </p>
          {groups.length > 0 && (
            <button
              type="button"
              className="wsm-secondary"
              onClick={() => {
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setPage(1);
              }}
            >
              Show all jobs
            </button>
          )}
        </div>
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

                <div className="av-job-card__extras">
                  <button
                    type="button"
                    className="wsm-secondary av-job-card__view"
                    onClick={() => setDetailGroup(group)}
                  >
                    <Eye size={15} aria-hidden="true" /> View Details
                  </button>
                </div>

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

      {detailGroup &&
        createPortal(
          <div
            className="av-tech-detail-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDetailGroup(null);
            }}
          >
            <section
              className="av-tech-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="av-tech-detail-heading"
            >
              <header className="av-tech-detail-header">
                <div>
                  <small>ASSIGNED WORK</small>
                  <h2 id="av-tech-detail-heading">
                    {detailGroup.jobs[0].serviceRequestId
                      ? `Service #${detailGroup.jobs[0].serviceRequestId}`
                      : `Order #${detailGroup.jobs[0].orderId || detailGroup.jobs[0].id}`}
                  </h2>
                </div>
                <button
                  type="button"
                  className="av-tech-detail-close"
                  aria-label="Close job details"
                  onClick={() => setDetailGroup(null)}
                >
                  <X size={20} />
                </button>
              </header>
              <div className="av-tech-detail-body">
                <dl className="av-tech-detail-fields">
                  {[
                    ["Customer", detailGroup.jobs[0].customer],
                    ["Phone", detailGroup.jobs[0].phone],
                    [
                      "Scheduled",
                      wallClock(detailGroup.jobs[0].scheduledStart),
                    ],
                    ["Address", detailGroup.jobs[0].address],
                    ["Destination", detailGroup.jobs[0].destinationAddress],
                    ["Team lead", detailGroup.jobs[0].teamLeader],
                    ["Team members", detailGroup.jobs[0].teamMembers],
                    [
                      "Job status",
                      getProgress(detailGroup).status.replaceAll("_", " "),
                    ],
                    ["Job type", detailGroup.jobs[0].workType],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                {detailGroup.jobs[0].serviceRequestId && (
                  <ServiceActivityHistory
                    requestId={detailGroup.jobs[0].serviceRequestId}
                  />
                )}
              </div>
              <footer className="av-tech-detail-footer">
                <button
                  type="button"
                  className="wsm-primary"
                  onClick={() => setDetailGroup(null)}
                >
                  Close details
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}

      {!previewLimit && totalPages > 1 && (
        <nav
          className="av-tech-page-controls"
          aria-label="Technician job pages"
        >
          <span>
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filteredGroups.length)} of{" "}
            {filteredGroups.length}
          </span>
          <div>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <strong>
              Page {safePage} of {totalPages}
            </strong>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
            </button>
          </div>
        </nav>
      )}
      {previewLimit && filteredGroups.length > previewLimit && (
        <p className="technician-jobs__more">
          <Link to="/management/schedules">
            View all matching jobs in Schedules{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
