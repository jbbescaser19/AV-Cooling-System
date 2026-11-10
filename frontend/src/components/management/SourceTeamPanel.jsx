import { useEffect, useState } from "react";
import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import TechnicianTeamPicker from "./TechnicianTeamPicker.jsx";

/** Team assignment stays on the originating order/service/Facebook screen.
 * Delivery and installation may each have their own team leader. */
export default function SourceTeamPanel({
  kind,
  sourceId,
  refreshKey = 0,
  onJobsChange,
}) {
  const [jobs, setJobs] = useState([]);
  const [members, setMembers] = useState([]);
  const [editingType, setEditingType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManage = ["OWNER", "MANAGER"].includes(getStaff()?.role);

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
        const next = data.jobs || [];
        setJobs(next);
        onJobsChange?.(next);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.response?.data?.message || "Unable to load assigned team.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, sourceId, refreshKey, canManage, onJobsChange]);

  if (!canManage)
    return (
      <p className="wsm-info">
        A manager or owner assigns the technician team for this job before work
        starts.
      </p>
    );

  function beginEdit(type, job = null) {
    setEditingType(type);
    setMembers((job?.members || []).map((person) => Number(person.id)));
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
      const body = { technicianIds: members };
      if (editingType !== "ALL") body.workType = editingType;
      const { data } = await api.patch(
        `/api/management/field-work/${kind}/${sourceId}`,
        body,
      );
      const updated = data.jobs || [];
      setJobs(updated);
      onJobsChange?.(updated);
      setEditingType(null);
      setNotice(
        "Technician team saved. The assigned workers can start their job when scheduled.",
      );
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not save the technician team.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="wsm-info"
      aria-label="Assigned technician teams"
      style={{ display: "grid", gap: 10 }}
    >
      <strong>Technician assignment</strong>
      {loading && <p role="status">Checking assigned teams…</p>}
      {!loading && jobs.length === 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <p>
            No field work assigned yet. Assign the workers here to create the
            needed job(s) automatically.
          </p>
          {editingType === null && (
            <button
              type="button"
              className="wsm-secondary"
              onClick={() => beginEdit("ALL")}
            >
              Assign technician team here
            </button>
          )}
        </div>
      )}
      {!loading &&
        jobs.map((job) => {
          const locked = ["IN_PROGRESS", "COMPLETED"].includes(job.status);
          return (
            <div
              key={job.id}
              style={{
                display: "grid",
                gap: 6,
                borderTop: "1px solid rgba(128,128,128,.2)",
                paddingTop: 10,
              }}
            >
              <strong>
                {job.type} ·{" "}
                {job.status === "PENDING"
                  ? "Pending assignment"
                  : job.status.replaceAll("_", " ")}
              </strong>
              <span>
                {job.leader
                  ? `Team ${job.leader.name} (TL)`
                  : "No technician team assigned"}
              </span>
              {job.members?.length > 1 && (
                <small>
                  Members:{" "}
                  {job.members
                    .slice(1)
                    .map((member) => member.name)
                    .join(", ")}
                </small>
              )}
              {!locked && editingType === null && (
                <button
                  type="button"
                  className="wsm-secondary"
                  onClick={() => beginEdit(job.type, job)}
                >
                  {job.members?.length
                    ? "Change team here"
                    : "Assign team here"}
                </button>
              )}
              {locked && (
                <small>
                  Started/completed jobs cannot have their teams changed here.
                </small>
              )}
            </div>
          );
        })}
      {editingType !== null && (
        <div style={{ display: "grid", gap: 8 }}>
          <strong>
            {editingType === "ALL"
              ? "Assign to all field jobs"
              : `Assign ${editingType.toLowerCase()} team`}
          </strong>
          <TechnicianTeamPicker
            value={members}
            onChange={setMembers}
            disabled={saving}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="wsm-primary"
              onClick={save}
              disabled={saving || !members.length}
            >
              {saving ? "Saving…" : "Save technician team"}
            </button>
            <button
              type="button"
              className="wsm-secondary"
              onClick={() => {
                setEditingType(null);
                setError("");
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="wsm-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="wsm-success">
          {notice}
        </p>
      )}
    </section>
  );
}
