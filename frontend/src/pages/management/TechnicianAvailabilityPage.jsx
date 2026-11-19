import { useEffect, useRef, useState } from "react";

import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import "../../styles/management/workspace.css";
import "../../styles/management/booking-calendar.css";

const endpoint = "/api/management/workspace/schedules";

const today = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

const moveMonth = (month, step) => {
  const [y, m] = month.split("-").map(Number);

  return new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 7);
};

const monthLabel = (month) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

const dateLabel = (date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const timeLabel = (row) =>
  row.startTime && row.endTime
    ? `${row.startTime} – ${row.endTime}`
    : "Whole day";

export default function TechnicianAvailabilityPage() {
  const role = getStaff()?.role;

  const canEdit = ["OWNER", "MANAGER"].includes(role);

  const canView = canEdit || role === "TECHNICIAN";

  const [month, setMonth] = useState(() => today().slice(0, 7));

  const [date, setDate] = useState(today);

  const [technicianId, setTechnicianId] = useState("");

  const [calendar, setCalendar] = useState({
    month: "",
    technicians: [],
    items: [],
  });

  const [reason, setReason] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const saving = useRef(false);
  const generation = useRef(0);

  // Automatically refresh when availability changes.
  useRealtimeRefresh(["schedules", "staff", "jobs"], setRevision);

  useEffect(() => {
    if (!canView) return;

    const controller = new AbortController();
    const current = generation.current;

    api
      .get(`${endpoint}/calendar`, {
        params: { month },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted || current !== generation.current) {
          return;
        }

        if (
          !data.success ||
          !Array.isArray(data.technicians) ||
          !Array.isArray(data.items)
        ) {
          throw new Error("Invalid calendar response.");
        }

        setCalendar({
          month,
          technicians: data.technicians,
          items: data.items,
        });

        setTechnicianId(
          (previous) =>
            previous ||
            String(
              (data.technicians.find((t) => t.canAdd) || data.technicians[0])
                ?.id || "",
            ),
        );

        setLoadError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted && current === generation.current) {
          setLoadError(
            err.response?.data?.message || "Unable to load availability.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [month, revision, canView]);

  // Recover from missed SSE updates or disconnections.
  useEffect(() => {
    if (!canView) return;

    const refresh = () => {
      if (document.visibilityState !== "hidden") {
        setRevision((n) => n + 1);
      }
    };

    const timer = window.setInterval(refresh, 15000);

    window.addEventListener("online", refresh);

    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);

      window.removeEventListener("online", refresh);

      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canView]);

  const ready = !loading && !loadError && calendar.month === month;

  const tech = calendar.technicians.find((t) => String(t.id) === technicianId);

  const rows =
    calendar.month === month
      ? calendar.items.filter(
          (r) => String(r.technicianId) === String(tech?.id),
        )
      : [];

  // Only dates containing OFF records are marked.
  const offDates = new Set(
    rows.filter((r) => r.status === "OFF").map((r) => r.date),
  );

  const dayRows = rows.filter((r) => r.date === date);

  const offRows = dayRows.filter((r) => r.status === "OFF");

  // Reuse a previously cancelled day-off record.
  const cleared = dayRows.find((r) => r.status === "AVAILABLE");

  const [year, m] = month.split("-").map(Number);

  const offset = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();

  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();

  function resetMessages() {
    setReason("");
    setError("");
    setNotice("");
  }

  function changeMonth(step) {
    const next = moveMonth(month, step);

    setLoading(true);
    setLoadError("");
    setMonth(next);
    setDate(`${next}-01`);

    resetMessages();
  }

  async function save(row = null, cancel = false) {
    if (!canEdit || !ready || !tech || saving.current) {
      return;
    }

    if (
      !cancel &&
      (!tech.canAdd || offRows.length || reason.trim().length < 3)
    ) {
      return;
    }

    if (cancel && !offRows.some((item) => item.id === row?.id)) {
      return;
    }

    const body = {
      status: cancel ? "AVAILABLE" : "OFF",
      reason: cancel ? "" : reason.trim(),
      startTime: "",
      endTime: "",
    };

    const existing = cancel ? row : cleared;

    saving.current = true;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (existing) {
        // Update the existing record rather than
        // creating another record for the same date.
        await api.patch(`${endpoint}/${existing.id}`, body);
      } else {
        await api.post(endpoint, {
          ...body,
          technicianId: Number(tech.id),
          date,
        });
      }

      generation.current += 1;

      setReason("");

      setNotice(cancel ? "Day off cancelled." : "Day off saved.");

      setLoading(true);
      setRevision((n) => n + 1);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save availability.");

      setRevision((n) => n + 1);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <p className="wsm-info">
        You do not have access to technician availability.
      </p>
    );
  }

  return (
    <div className="wsm-page">
      <header className="wsm-head">
        <div>
          <span className="wsm-kicker">AV COOLING · MANAGEMENT</span>

          <h1>Technician Availability</h1>

          <p>Select a technician and a date to manage days off.</p>
        </div>
      </header>

      {loadError && (
        <p className="wsm-error" role="alert">
          {loadError}
        </p>
      )}

      {notice && (
        <p className="wsm-success" role="status">
          {notice}
        </p>
      )}

      {/* TECHNICIAN SELECTION */}

      <section className="wsm-panel">
        {canEdit ? (
          <label className="wsm-field">
            Technician
            <select
              value={tech ? String(tech.id) : ""}
              disabled={busy || !ready}
              onChange={(e) => {
                setTechnicianId(e.target.value);
                resetMessages();
              }}
            >
              {!tech && <option value="">Choose technician</option>}

              {calendar.technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <strong>{tech?.label || "My availability"}</strong>
        )}
      </section>

      <div className="booking-manage__columns">
        {/* AVAILABILITY CALENDAR */}

        <section
          className="booking-picker"
          aria-label="Technician day-off calendar"
        >
          <div className="booking-picker__month">
            <button
              type="button"
              disabled={busy || month <= "1000-01"}
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>

            <strong>{monthLabel(month)}</strong>

            <button
              type="button"
              disabled={busy || month >= "9999-12"}
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="booking-picker__grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d} className="booking-picker__weekday">
                {d}
              </span>
            ))}

            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}

            {Array.from({ length: days }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`;

              const off = offDates.has(day);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!ready || busy || !tech}
                  aria-pressed={date === day}
                  aria-label={`${dateLabel(day)}${off ? ", unavailable" : ""}`}
                  className={`booking-picker__day${off ? " is-full" : ""}`}
                  style={
                    date === day
                      ? {
                          outline: "2px solid #2563eb",
                          outlineOffset: 1,
                        }
                      : undefined
                  }
                  onClick={() => {
                    setDate(day);
                    resetMessages();
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="booking-calendar-legend">
            <span>
              <i className="calendar-dot is-full" />
              Day off / unavailable
            </span>
          </div>

          {loading && <p role="status">Loading availability…</p>}
        </section>

        {/* SELECTED DATE */}

        <section className="booking-manage__panel">
          <h2>{dateLabel(date)}</h2>

          {ready && tech ? (
            offRows.length ? (
              offRows.map((row) => (
                <div className="booking-manage__row" key={row.id}>
                  <div>
                    <strong>
                      {row.startTime ? "Unavailable period" : "Day off"}
                    </strong>

                    <small>{timeLabel(row)}</small>

                    <p
                      style={{
                        overflowWrap: "anywhere",
                      }}
                    >
                      Reason: {row.reason}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save(row, true)}
                    >
                      {busy
                        ? "Saving…"
                        : row.startTime
                          ? "Cancel period"
                          : "Cancel day off"}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <>
                <p className="booking-manage__success">No day off recorded.</p>

                {canEdit && tech.canAdd && (
                  <form
                    className="wsm-form"
                    style={{ padding: 0 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      save();
                    }}
                  >
                    <label className="wsm-field">
                      Reason for day off
                      <textarea
                        value={reason}
                        rows={2}
                        minLength={3}
                        maxLength={200}
                        required
                        disabled={busy}
                        placeholder="e.g. Personal leave"
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>

                    <div className="wsm-form-actions">
                      <button
                        className="wsm-primary"
                        type="submit"
                        disabled={busy || reason.trim().length < 3}
                      >
                        {busy ? "Saving…" : "Set day off"}
                      </button>
                    </div>
                  </form>
                )}

                {canEdit && !tech.canAdd && <p>This technician is inactive.</p>}
              </>
            )
          ) : (
            <p>
              {ready
                ? "No technician found."
                : "Waiting for current availability."}
            </p>
          )}

          {error && (
            <p className="wsm-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
