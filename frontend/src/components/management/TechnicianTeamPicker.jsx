import { useEffect, useState } from "react";
import api from "../../../api/api.js";
import "../../styles/management/technician-team-picker.css";

export default function TechnicianTeamPicker({
  value = [],
  onChange,
  disabled = false,
}) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/management/workspace/technicians", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setTechnicians(
            (data.items || []).filter((item) => item.status === "ACTIVE"),
          );
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err.response?.data?.message ||
              "Cannot load technicians. Try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  function toggle(id, checked) {
    const next = checked ? [...value, id] : value.filter((item) => item !== id);

    onChange(next);
  }

  const leader = technicians.find(
    (tech) => Number(tech.id) === Number(value[0]),
  );

  return (
    <fieldset className="av-team-picker" disabled={disabled || loading}>
      <legend>Technician team</legend>

      <p className="av-team-picker__hint">
        Select up to 6 workers. The first technician is the team leader (TL).
        You can change the team leader below.
      </p>

      {loading && <p role="status">Loading technicians…</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && !technicians.length && (
        <p>No active technicians available for assignment.</p>
      )}

      <div className="av-team-picker__choices">
        {technicians.map((tech) => {
          const id = Number(tech.id);
          const checked = value.includes(id);

          return (
            <label className="av-team-picker__choice" key={tech.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => toggle(id, event.target.checked)}
                disabled={disabled || (!checked && value.length >= 6)}
              />

              <span>{tech.name}</span>
            </label>
          );
        })}
      </div>

      {value.length > 0 && (
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
            value={value[0]}
            disabled={disabled}
            onChange={(event) => {
              const id = Number(event.target.value);

              onChange([id, ...value.filter((item) => item !== id)]);
            }}
          >
            {value.map((id) => (
              <option key={id} value={id}>
                {technicians.find((tech) => Number(tech.id) === Number(id))
                  ?.name || `Technician #${id}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="av-team-picker__hint">
        {leader
          ? `Team ${leader.name} · ${value.length} worker(s)`
          : "Pending assignment — cannot start work until a team is assigned"}
      </p>
    </fieldset>
  );
}
