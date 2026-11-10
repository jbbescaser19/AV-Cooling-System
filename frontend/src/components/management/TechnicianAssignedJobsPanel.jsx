import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Play, RefreshCw, Wrench } from "lucide-react";
import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import "../../styles/management/technician-jobs.css";

/**
 * Technician job actions live in the existing Schedules page.
 * Work-order records remain the internal source of truth, not a separate page.
 */
export default function TechnicianAssignedJobsPanel({ limit = null }) {
  const isTechnician = getStaff()?.role === "TECHNICIAN";
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [completionId, setCompletionId] = useState(null);
  const [completionNotes, setCompletionNotes] = useState("");
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
              "Unable to load your assigned jobs.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isTechnician, revision]);

  // A newly confirmed assignment should appear without navigating away.
  // Background reads never count as session activity on the server.
  useEffect(() => {
    if (!isTechnician) return undefined;
    const refresh = () => setRevision((value) => value + 1);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const poll = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("av-management-updated", refresh);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("av-management-updated", refresh);
    };
  }, [isTechnician]);

  const sorted = useMemo(() => {
    const priority = {
      IN_PROGRESS: 0,
      ASSIGNED: 1,
      PENDING: 2,
      COMPLETED: 3,
      CANCELLED: 4,
    };
    return [...jobs].sort(
      (a, b) =>
        (priority[a.status] ?? 5) - (priority[b.status] ?? 5) ||
        Number(b.id) - Number(a.id),
    );
  }, [jobs]);

  const visibleJobs =
    limit && Number.isInteger(limit) && limit > 0
      ? sorted.slice(0, limit)
      : sorted;

  const activeCount = jobs.filter((job) =>
    ["ASSIGNED", "IN_PROGRESS"].includes(job.status),
  ).length;

  async function changeStatus(job, status, notes = "") {
    if (busyId !== null) return;
    if (
      status === "IN_PROGRESS" &&
      !window.confirm(`Start ${job.workType.toLowerCase()} job #${job.id}?`)
    ) {
      return;
    }
    if (status === "COMPLETED" && notes.trim().length < 5) {
      setError(
        `Write a short completion summary (at least 5 characters). ${Math.max(0, 5 - notes.trim().length)} more needed.`,
      );
      return;
    }

    setBusyId(job.id);
    setError("");
    setNotice("");
    try {
      const { data } = await api.patch(
        `/api/management/workspace/work-orders/${encodeURIComponent(job.id)}`,
        {
          status,
          notes: notes.trim(),
          technicianId: null,
          technicianIds: [],
          scheduledStart: null,
        },
      );
      if (!data.success)
        throw new Error(data.message || "The job update was not saved.");
      setNotice(
        status === "IN_PROGRESS"
          ? `Job #${job.id} has started.`
          : `Job #${job.id} was marked completed.`,
      );
      setCompletionId(null);
      setCompletionNotes("");
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not update your job.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!isTechnician) return null;

  return (
    <section
      className="technician-jobs wsm-panel"
      aria-label="My assigned technician jobs"
    >
      <div className="technician-jobs__heading">
        <div>
          <span className="technician-jobs__eyebrow">
            <Wrench size={15} /> MY JOBS
          </span>
          <h2>Assigned work</h2>
          <p>
            Start or complete the jobs assigned to your team, right here in
            Schedules.
          </p>
        </div>
        <div className="technician-jobs__actions">
          <span className="technician-jobs__count">{activeCount} active</span>
          <button
            type="button"
            className="wsm-secondary"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading || busyId !== null}
          >
            <RefreshCw size={15} /> Refresh
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
        <p className="technician-jobs__empty" role="status">
          Loading your jobs…
        </p>
      ) : sorted.length === 0 ? (
        <p className="technician-jobs__empty">
          You have no assigned jobs yet. Your team leader or Management will
          assign them.
        </p>
      ) : (
        <div className="technician-jobs__list">
          {visibleJobs.map((job) => {
            const canStart = job.status === "ASSIGNED";
            const canFinish = job.status === "IN_PROGRESS";
            const isCompleting = completionId === job.id;
            return (
              <article key={job.id} className="technician-jobs__card">
                <div className="technician-jobs__card-main">
                  <div className="technician-jobs__title">
                    <strong>
                      {job.workType.replaceAll("_", " ")} #{job.id}
                    </strong>
                    <span
                      className={`technician-jobs__status technician-jobs__status--${job.status.toLowerCase()}`}
                    >
                      {job.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p>
                    {job.customer || "Customer not provided"}
                    {job.serviceRequestId
                      ? ` · Service #${job.serviceRequestId}`
                      : job.orderId
                        ? ` · Order #${job.orderId}`
                        : ""}
                  </p>
                  {job.teamLeader && (
                    <small>
                      Team {job.teamLeader}: {job.teamMembers || job.teamLeader}
                    </small>
                  )}
                  {job.address && <small>Location: {job.address}</small>}
                  {job.phone && <small>Contact: {job.phone}</small>}
                  <small>
                    <Clock3 size={14} />{" "}
                    {job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Schedule not set"}
                  </small>
                </div>
                <div className="technician-jobs__card-actions">
                  {canStart && (
                    <button
                      type="button"
                      className="wsm-primary"
                      disabled={busyId !== null}
                      onClick={() => changeStatus(job, "IN_PROGRESS")}
                    >
                      <Play size={16} />{" "}
                      {busyId === job.id ? "Saving…" : "Start job"}
                    </button>
                  )}
                  {canFinish && !isCompleting && (
                    <button
                      type="button"
                      className="wsm-primary"
                      disabled={busyId !== null}
                      onClick={() => {
                        setCompletionId(job.id);
                        setCompletionNotes("");
                        setError("");
                      }}
                    >
                      <CheckCircle2 size={16} /> Complete job
                    </button>
                  )}
                  {job.status === "PENDING" && (
                    <small>
                      Management must assign a team before this job can start.
                    </small>
                  )}
                </div>
                {isCompleting && (
                  <form
                    className="technician-jobs__complete"
                    onSubmit={(event) => {
                      event.preventDefault();
                      changeStatus(job, "COMPLETED", completionNotes);
                    }}
                  >
                    <label htmlFor={`completion-notes-${job.id}`}>
                      Completion summary (required)
                    </label>
                    <p className="technician-jobs__summary-help">
                      Briefly record what your team did and the result. For
                      example: “Cleaned filters, tested cooling, and confirmed
                      normal operation.”
                    </p>
                    <textarea
                      id={`completion-notes-${job.id}`}
                      required
                      minLength={5}
                      maxLength={1000}
                      rows={3}
                      placeholder="Example: Cleaned filters, tested cooling; unit working normally."
                      value={completionNotes}
                      disabled={busyId !== null}
                      onChange={(event) =>
                        setCompletionNotes(event.target.value)
                      }
                    />
                    <small
                      className="technician-jobs__char-hint"
                      aria-live="polite"
                    >
                      {completionNotes.trim().length < 5
                        ? `${5 - completionNotes.trim().length} more characters required before confirming.`
                        : "Ready to confirm. This note will be saved in the job history."}
                    </small>
                    {error && (
                      <p className="wsm-error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="technician-jobs__complete-actions">
                      <button
                        type="button"
                        className="wsm-secondary"
                        onClick={() => setCompletionId(null)}
                        disabled={busyId !== null}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="wsm-primary"
                        disabled={
                          busyId !== null || completionNotes.trim().length < 5
                        }
                      >
                        {busyId === job.id ? "Saving…" : "Confirm completion"}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
      {limit && sorted.length > limit && (
        <p className="technician-jobs__more">
          <Link to="/management/schedules">
            View all {sorted.length} jobs in Schedules
          </Link>
        </p>
      )}
    </section>
  );
}
