import { useEffect, useState } from "react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import "../../styles/management/technician-team-picker.css";

export default function TechnicianTeamPicker({
  value = [],
  onChange,
  disabled = false,
  scheduledStart = "",
  kind = "NONE",
  sourceId,
}) {
  const [snapshot, setSnapshot] = useState({
    key: "",
    technicians: [],
  });

  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const key = JSON.stringify([scheduledStart, kind, sourceId ?? null]);

  const ready = Boolean(scheduledStart && snapshot.key === key && !error);

  const technicians = ready ? snapshot.technicians : [];

  const selectedIds = value.map(Number);

  useRealtimeRefresh(
    ["schedules", "staff", "jobs", "orders", "services"],
    setRevision,
  );

  useEffect(() => {
    if (!scheduledStart) return;

    const controller = new AbortController();

    api
      .get("/api/management/workspace/technicians/availability", {
        params: {
          scheduledStart,
          kind,
          ...(kind !== "NONE" ? { sourceId } : {}),
        },

        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        if (!data.success || !Array.isArray(data.technicians)) {
          throw new Error("Invalid availability response.");
        }

        setSnapshot({
          key,
          technicians: data.technicians,
        });

        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err.response?.data?.message ||
              "Cannot verify technician availability.",
          );
        }
      });

    return () => controller.abort();
  }, [key, scheduledStart, kind, sourceId, revision]);

  // Backup refresh if an SSE event is missed.
  useEffect(() => {
    if (!scheduledStart) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        setRevision((n) => n + 1);
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [scheduledStart]);

  // Remove selected technicians who become unavailable.
  useEffect(() => {
    if (disabled || !ready || !onChange) return;

    const next = value.filter((id) =>
      snapshot.technicians.some(
        (tech) => tech.available && Number(tech.id) === Number(id),
      ),
    );

    if (next.length !== value.length) {
      onChange(next);
    }
  }, [disabled, ready, snapshot, value, onChange]);

  function toggle(id, checked) {
    if (disabled || !ready) return;

    if (
      checked &&
      (selectedIds.length >= 6 ||
        !technicians.some((tech) => tech.id === id && tech.available))
    ) {
      return;
    }

    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((v) => v !== id),
    );
  }

  const leader = technicians.find((tech) => tech.id === selectedIds[0]);

  return (
    <fieldset className="av-team-picker" disabled={disabled || !ready}>
      <legend>Technician team</legend>

      <p className="av-team-picker__hint">
        Select up to 6 workers. The first is the team leader (TL).
      </p>

      {!scheduledStart ? (
        <p>Choose an appointment first.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !ready ? (
        <p role="status">Checking technician availability…</p>
      ) : !technicians.length ? (
        <p>No technician profiles found.</p>
      ) : null}

      <div className="av-team-picker__choices">
        {technicians.map((tech) => {
          const id = Number(tech.id);

          const checked = selectedIds.includes(id);

          return (
            <label className="av-team-picker__choice" key={id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={
                  !tech.available || (!checked && selectedIds.length >= 6)
                }
                onChange={(event) => toggle(id, event.target.checked)}
              />

              <span>
                {tech.name}

                {!tech.available && (
                  <small
                    style={{
                      display: "block",
                      color: "#a52626",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {tech.reason}
                  </small>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {ready && selectedIds.length > 0 && (
        <label
          className="av-team-picker__hint"
          style={{
            display: "grid",
            gap: 6,
            marginTop: 10,
          }}
        >
          Team leader (TL)
          <select
            value={selectedIds[0]}
            onChange={(event) => {
              const id = Number(event.target.value);

              onChange([id, ...selectedIds.filter((v) => v !== id)]);
            }}
          >
            {selectedIds.map((id) => (
              <option key={id} value={id}>
                {technicians.find((tech) => tech.id === id)?.name ||
                  `Technician #${id}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="av-team-picker__hint">
        {leader
          ? `Team ${leader.name} · ${selectedIds.length} worker(s)`
          : "Pending assignment — cannot start work until a team is assigned"}
      </p>
    </fieldset>
  );
}
