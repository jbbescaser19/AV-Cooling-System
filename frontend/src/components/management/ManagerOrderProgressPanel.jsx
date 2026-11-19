import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, PhoneCall, PlayCircle } from "lucide-react";

import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.js";

import "../../styles/management/manager-progress.css";

const confirmationMethods = [
  "Assigned technician confirmed by phone call",
  "Assigned technician confirmed by text or chat",
  "Customer confirmed the job status",
  "Personally verified on site",
];

const serviceFindings = [
  "Installed and tested; unit operating normally",
  "Service completed; unit operating normally",
  "Service completed; follow-up recommended",
  "Service completed; customer informed of findings",
];

const deliveryFindings = [
  "Products delivered and received by customer",
  "Delivery completed; products inspected with customer",
];

function nextAction(jobs) {
  const delivery = jobs.find((job) => job.type === "DELIVERY");

  const installation = jobs.find((job) => job.type === "INSTALLATION");

  if (!delivery && !installation) {
    return {
      code: null,
      issue: "Assign a technician team before recording progress.",
    };
  }

  const ordered = [delivery, installation].filter(Boolean);

  if (ordered.some((job) => !job.members?.length)) {
    return {
      code: null,
      issue: "Assign a technician team to each linked job first.",
    };
  }

  if (ordered.length === 2) {
    const firstTeam = ordered[0].members
      .map((member) => Number(member.id))
      .sort()
      .join(",");

    const otherTeam = ordered[1].members
      .map((member) => Number(member.id))
      .sort()
      .join(",");

    if (firstTeam !== otherTeam) {
      return {
        code: null,
        issue:
          "Delivery and installation teams differ. Review the assignment first.",
      };
    }
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

  if (starting) {
    return { code: `START_${mode}`, issue: "" };
  }

  if (completing) {
    return { code: `COMPLETE_${mode}`, issue: "" };
  }

  return {
    code: null,
    issue: "This job is completed or its stages need management review.",
  };
}

export default function ManagerOrderProgressPanel({
  order,
  jobs,
  loading,
  onUpdated,
}) {
  const [method, setMethod] = useState("");
  const [customMethod, setCustomMethod] = useState("");

  const [finding, setFinding] = useState("");
  const [customFinding, setCustomFinding] = useState("");

  const [savedCode, setSavedCode] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);

  const { code, issue } = useMemo(() => nextAction(jobs || []), [jobs]);

  useEffect(() => {
    setSavedCode(null);
    setMethod("");
    setCustomMethod("");
    setFinding("");
    setCustomFinding("");
    setError("");
  }, [order.id]);

  const report = method === "OTHER" ? customMethod : method;

  const notes = finding === "OTHER" ? customFinding : finding;

  const isCompletion = code?.startsWith("COMPLETE_");

  const isService = code?.endsWith("SERVICE");

  const label = !code
    ? "No action available"
    : `${isCompletion ? "Record completion" : "Record start"} of ${
        isService ? "service" : "delivery"
      }`;

  const canSubmit =
    code &&
    report.trim().length >= 5 &&
    savedCode !== code &&
    (!isCompletion || notes.trim().length >= 5) &&
    !busy &&
    !loading;

  if (!["CONFIRMED", "SCHEDULED", "IN_PROGRESS"].includes(order.status)) {
    return null;
  }

  async function submit(event) {
    event.preventDefault();

    if (!canSubmit || lock.current) return;

    lock.current = true;

    setBusy(true);
    setError("");

    try {
      const approved = await confirmAction({
        title: label,

        message:
          "Confirm that the reported job progress is accurate. " +
          "This updates the customer order and technician records.",

        confirmText: label,
      });

      if (!approved) return;

      const { data } = await api.patch(
        `/api/management/workspace/technician-order-progress/${encodeURIComponent(order.id)}`,
        {
          action: code,
          onBehalfReason: report.trim(),
          notes: notes.trim(),
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Could not save progress.");
      }

      setSavedCode(code);
      setMethod("");
      setCustomMethod("");
      setFinding("");
      setCustomFinding("");

      onUpdated?.();

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not record progress.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="av-manager-progress"
      aria-label="Record technician progress"
    >
      <header>
        <PhoneCall size={19} aria-hidden="true" />

        <div>
          <h3>Technician progress</h3>

          <p>
            The system automatically records your staff account. Select how you
            confirmed the work.
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
            How was the work confirmed? <span>Required</span>
            <select
              required
              value={method}
              disabled={busy}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">Select confirmation method</option>

              {confirmationMethods.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}

              <option value="OTHER">Other</option>
            </select>
          </label>

          {method === "OTHER" && (
            <label>
              Other confirmation method
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={2}
                value={customMethod}
                disabled={busy}
                onChange={(e) => setCustomMethod(e.target.value)}
              />
            </label>
          )}

          {isCompletion && (
            <>
              <label>
                Work completed / findings <span>Required</span>
                <select
                  required
                  value={finding}
                  disabled={busy}
                  onChange={(e) => setFinding(e.target.value)}
                >
                  <option value="">Select work findings</option>

                  {(isService ? serviceFindings : deliveryFindings).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}

                  <option value="OTHER">Other</option>
                </select>
              </label>

              {finding === "OTHER" && (
                <label>
                  Other findings
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    value={customFinding}
                    disabled={busy}
                    onChange={(e) => setCustomFinding(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          {savedCode === code && (
            <p role="status">Progress saved. Refreshing job stages…</p>
          )}

          {error && (
            <p className="av-manager-progress__error" role="alert">
              {error}
            </p>
          )}

          <button className="wsm-primary" type="submit" disabled={!canSubmit}>
            {busy ? "Saving…" : label}
          </button>

          {!canSubmit && !busy && savedCode !== code && (
            <small>
              Select the confirmation method
              {isCompletion ? " and work findings" : ""} before saving.
            </small>
          )}
        </form>
      )}
    </section>
  );
}
