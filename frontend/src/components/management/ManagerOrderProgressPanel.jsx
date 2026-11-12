import { useMemo, useState } from "react";
import { CheckCircle2, PhoneCall, PlayCircle } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/manager-progress.css";

function nextAction(jobs) {
  const delivery = jobs.find((job) => job.type === "DELIVERY");
  const installation = jobs.find((job) => job.type === "INSTALLATION");
  if (!delivery && !installation)
    return {
      code: null,
      issue: "Assign a technician team before recording progress.",
    };
  const ordered = [delivery, installation].filter(Boolean);
  if (ordered.some((job) => !job.members?.length))
    return {
      code: null,
      issue: "Assign a technician team to each linked job first.",
    };
  if (ordered.length === 2) {
    const firstTeam = ordered[0].members
      .map((m) => Number(m.id))
      .sort()
      .join(",");
    const otherTeam = ordered[1].members
      .map((m) => Number(m.id))
      .sort()
      .join(",");
    if (firstTeam !== otherTeam)
      return {
        code: null,
        issue:
          "Delivery and installation teams differ. Review the assignment first.",
      };
  }
  const mode = installation ? "SERVICE" : "DELIVERY";
  const state = ordered.map((job) => job.status).join(":");
  const starting =
    ordered.length === 2
      ? [
          "ASSIGNED:ASSIGNED",
          "IN_PROGRESS:ASSIGNED",
          "COMPLETED:ASSIGNED",
        ].includes(state)
      : state === "ASSIGNED";
  const completing =
    ordered.length === 2
      ? ["IN_PROGRESS:IN_PROGRESS", "COMPLETED:IN_PROGRESS"].includes(state)
      : state === "IN_PROGRESS";
  if (starting) return { code: `START_${mode}`, issue: "" };
  if (completing) return { code: `COMPLETE_${mode}`, issue: "" };
  return {
    code: null,
    issue: "This job is completed or its stages need management review.",
  };
}

/** Manager records a confirmed technician report, not a claim that
 * management personally went on site. The backend validates and audits it. */
export default function ManagerOrderProgressPanel({
  order,
  jobs,
  loading,
  onUpdated,
}) {
  const [report, setReport] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { code, issue } = useMemo(() => nextAction(jobs || []), [jobs]);
  if (!["CONFIRMED", "SCHEDULED", "IN_PROGRESS"].includes(order.status))
    return null;
  const isCompletion = code?.startsWith("COMPLETE_");
  const label = !code
    ? "No action available"
    : `${isCompletion ? "Record completion" : "Record start"} of ${code.endsWith("SERVICE") ? "service" : "delivery"}`;
  const canSubmit =
    code &&
    report.trim().length >= 10 &&
    (!isCompletion || notes.trim().length >= 5) &&
    !busy &&
    !loading;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    if (
      !window.confirm(
        `Record ${code.replaceAll("_", " ").toLowerCase()} based on the technician's report? This updates the customer order.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch(
        `/api/management/workspace/technician-order-progress/${encodeURIComponent(order.id)}`,
        { action: code, onBehalfReason: report.trim(), notes: notes.trim() },
      );
      if (!data.success)
        throw new Error(data.message || "Could not save progress.");
      setNotes("");
      setReport("");
      onUpdated?.();
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Could not record progress.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="av-manager-progress"
      aria-label="Record technician report"
    >
      <header>
        <PhoneCall size={19} aria-hidden="true" />
        <div>
          <h3>Technician progress · Manager / Owner</h3>
          <p>
            If the assigned crew calls instead of using the app, record their
            report here. The logged-in staff member is saved in the audit
            history.
          </p>
        </div>
      </header>
      {loading ? (
        <p role="status">Checking job stages…</p>
      ) : issue ? (
        <p className="av-manager-progress__help">{issue}</p>
      ) : (
        <form onSubmit={submit}>
          <div className="av-manager-progress__next">
            {isCompletion ? (
              <CheckCircle2 size={18} />
            ) : (
              <PlayCircle size={18} />
            )}
            <strong>{label}</strong>
          </div>
          <label>
            Who reported this, and how was it confirmed? <span>Required</span>
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={2}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="e.g. Technician Juan called the store and confirmed service started on site."
            />
          </label>
          {isCompletion && (
            <label>
              Work completed / findings <span>Required</span>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the completed work and results."
              />
            </label>
          )}
          {error && (
            <p className="av-manager-progress__error" role="alert">
              {error}
            </p>
          )}
          <button className="wsm-primary" type="submit" disabled={!canSubmit}>
            {busy ? "Saving…" : label}
          </button>
          {!canSubmit && !busy && (
            <small>
              Enter the technician's report
              {isCompletion ? " and work summary" : ""} before saving.
            </small>
          )}
        </form>
      )}
    </section>
  );
}
