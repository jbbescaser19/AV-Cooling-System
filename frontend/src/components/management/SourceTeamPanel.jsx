import { useEffect, useState } from "react";
import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import TechnicianTeamPicker from "./TechnicianTeamPicker.jsx";
import "../../styles/management/service-operations-panels.css";

/** One crew for an order's delivery and installation.
 * Work orders remain separate to track distinct delivery/installation stages.
 */
export default function SourceTeamPanel({
  kind,
  sourceId,
  refreshKey = 0,
  onJobsChange,
}) {
  const [jobs, setJobs] = useState([]);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = ["OWNER", "MANAGER"].includes(getStaff()?.role);
  const combined =
    kind === "ORDER" &&
    jobs.some((job) => job.type === "DELIVERY") &&
    jobs.some((job) => job.type === "INSTALLATION");
  const combinedJobs = combined
    ? jobs.filter((job) => ["DELIVERY", "INSTALLATION"].includes(job.type))
    : [];
  const hasStarted = combinedJobs.some((job) =>
    ["IN_PROGRESS", "COMPLETED"].includes(job.status),
  );
  const leadJob =
    combinedJobs.find((job) => job.members?.length) || combinedJobs[0];
  const mismatched =
    combined &&
    combinedJobs.some(
      (job) =>
        JSON.stringify(
          (job.members || []).map((member) => Number(member.id)),
        ) !==
        JSON.stringify(
          (leadJob?.members || []).map((member) => Number(member.id)),
        ),
    );

  useEffect(() => {
    if (!sourceId || !canManage) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get(`/api/management/field-work/${kind}/${sourceId}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const next = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs(next);
        onJobsChange?.(next);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Could not load assigned team.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, sourceId, refreshKey, canManage, onJobsChange]);

  if (!canManage) {
    return (
      <p className="wsm-info">
        An Owner or Manager assigns the technician team before work starts.
      </p>
    );
  }

  function beginEdit(type = null, job = null) {
    setSelectedType(type);
    setMembers((job?.members || []).map((member) => Number(member.id)));
    setEditing(true);
    setError("");
    setNotice("");
  }

  async function save() {
    if (saving || !members.length) {
      setError("Select a team leader and at least one technician.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // Combined delivery + installation: one team update changes BOTH jobs.
      const body = { technicianIds: members };
      if (!combined && selectedType) body.workType = selectedType;
      const { data } = await api.patch(
        `/api/management/field-work/${kind}/${sourceId}`,
        body,
      );
      if (!data.success) throw new Error("Assignment was not saved.");
      const updated = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(updated);
      onJobsChange?.(updated);
      setEditing(false);
      setNotice(
        combined
          ? "One crew saved for both delivery and installation."
          : "Technician team saved.",
      );
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not save team.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="av-shared-team" aria-label="Technician assignment">
      <div className="av-shared-team__heading">
        <div>
          <h3>
            {combined
              ? "Delivery & installation team"
              : "Technician assignment"}
          </h3>
          <p>
            {combined
              ? "The same crew delivers the aircon and completes its installation. Assign only once."
              : "Assign the team responsible for this job."}
          </p>
        </div>
      </div>

      {loading && <p role="status">Loading technician assignment…</p>}
      {!loading && jobs.length === 0 && (
        <div className="av-shared-team__job">
          <p>No field jobs have been created yet.</p>
          {!editing && (
            <button
              type="button"
              className="wsm-secondary"
              onClick={() => beginEdit()}
            >
              Assign technician team
            </button>
          )}
        </div>
      )}

      {!loading && combined && (
        <div className="av-shared-team__job">
          <strong>
            {leadJob?.leader
              ? `Team ${leadJob.leader.name} (Team Leader)`
              : "No team assigned yet"}
          </strong>
          {leadJob?.members?.length > 1 && (
            <small>
              Team members:{" "}
              {leadJob.members
                .slice(1)
                .map((member) => member.name)
                .join(", ")}
            </small>
          )}
          {combinedJobs.map((job) => (
            <small key={job.id}>
              {job.type === "DELIVERY" ? "Delivery" : "Installation"}:{" "}
              {job.status.replaceAll("_", " ")}
            </small>
          ))}
          {mismatched && (
            <p className="wsm-error" role="alert">
              Older records have different teams assigned.{" "}
              {hasStarted
                ? "The job has started; ask Management to reconcile these records before further work."
                : "Save the shared team once to synchronize both assignments."}
            </p>
          )}
          {!editing && !hasStarted && (
            <button
              type="button"
              className="wsm-secondary"
              onClick={() => beginEdit(null, leadJob)}
            >
              {leadJob?.members?.length
                ? "Change shared team"
                : "Assign shared team"}
            </button>
          )}
          {hasStarted && (
            <small>
              The team cannot be changed after delivery or installation starts.
            </small>
          )}
        </div>
      )}

      {!loading &&
        !combined &&
        jobs.map((job) => {
          const locked = ["IN_PROGRESS", "COMPLETED"].includes(job.status);
          return (
            <div className="av-shared-team__job" key={job.id}>
              <strong>
                {job.type} · {job.status.replaceAll("_", " ")}
              </strong>
              <span>
                {job.leader
                  ? `Team ${job.leader.name} (Team Leader)`
                  : "No team assigned yet"}
              </span>
              {job.members?.length > 1 && (
                <small>
                  Members:{" "}
                  {job.members
                    .slice(1)
                    .map((person) => person.name)
                    .join(", ")}
                </small>
              )}
              {!locked && !editing && (
                <button
                  type="button"
                  className="wsm-secondary"
                  onClick={() => beginEdit(job.type, job)}
                >
                  {job.members?.length ? "Change team" : "Assign team"}
                </button>
              )}
              {locked && (
                <small>
                  A started or completed job's team cannot be changed.
                </small>
              )}
            </div>
          );
        })}

      {editing && (
        <div className="av-shared-team__edit">
          <strong>
            {combined
              ? "Select one delivery & installation crew"
              : "Select a technician team"}
          </strong>
          <TechnicianTeamPicker
            value={members}
            onChange={setMembers}
            disabled={saving}
          />
          <div className="av-shared-team__actions">
            <button
              type="button"
              className="wsm-primary"
              disabled={saving || !members.length}
              onClick={save}
            >
              {saving ? "Saving…" : combined ? "Save shared team" : "Save team"}
            </button>
            <button
              type="button"
              className="wsm-secondary"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
    </section>
  );
}
