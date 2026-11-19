import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import WorkHistoryModal from "../../components/management/WorkHistoryModal.jsx";
import { History } from "lucide-react";
import "../../styles/management/booking-calendar.css";

const today = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

const moveMonth = (month, by) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

const titleMonth = (value) =>
  new Date(`${value}-01T00:00:00Z`).toLocaleString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const displayTime = (start) =>
  start
    ? new Date(`2026-01-01T${start}:00+08:00`).toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      })
    : "All day";

export default function TechnicianBookingCalendar() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [date, setDate] = useState(today);
  const [jobs, setJobs] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadedMonthRef = useRef(null);

  useRealtimeRefresh(["schedules", "jobs", "services", "orders"], setRevision);

  const [historyJob, setHistoryJob] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    if (loadedMonthRef.current !== month) {
      setLoading(true);
    }

    api
      .get("/api/management/schedule/my-calendar", {
        params: { month },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setJobs(data.jobs || []);
          setUpcoming(data.upcoming || []);
          loadedMonthRef.current = month;
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err.response?.data?.message || "Unable to load your schedule.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [month, revision]);

  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);

    window.addEventListener("av-management-updated", refresh);

    return () => {
      window.removeEventListener("av-management-updated", refresh);
    };
  }, []);

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);

    return Array.from(
      { length: new Date(Date.UTC(y, m, 0)).getUTCDate() },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    );
  }, [month]);

  const offset = new Date(`${month}-01T00:00:00Z`).getUTCDay();

  const chosenJobs = jobs.filter((job) => job.date === date);

  return (
    <main className="booking-manage">
      <header>
        <h1>My Appointment Calendar</h1>

        <p className="booking-manage__intro">
          Only your assigned and pending service, installation, and delivery
          appointments. Jobs assigned to other technicians stay private.
        </p>
      </header>

      {error && (
        <p role="alert" className="booking-manage__error">
          {error}
        </p>
      )}

      <div className="booking-manage__columns">
        <section className="booking-manage__panel">
          <div className="booking-picker__month">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                setMonth(moveMonth(month, -1));
                setDate("");
              }}
            >
              ‹
            </button>

            <strong>{titleMonth(month)}</strong>

            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                setMonth(moveMonth(month, 1));
                setDate("");
              }}
            >
              ›
            </button>
          </div>

          <div className="booking-picker__grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
              <span key={dayName} className="booking-picker__weekday">
                {dayName}
              </span>
            ))}

            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}

            {days.map((day) => {
              const assigned = jobs.filter((job) => job.date === day).length;

              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={date === day}
                  className={`booking-picker__day ${
                    date === day ? "is-selected" : ""
                  } ${assigned ? "is-partial" : ""}`}
                  aria-label={`${day}: ${assigned} assigned job(s)`}
                  onClick={() => setDate(day)}
                >
                  {Number(day.slice(-2))}

                  {assigned > 0 && (
                    <small
                      aria-hidden="true"
                      style={{
                        display: "block",
                        fontSize: ".61rem",
                        lineHeight: 1.15,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {assigned} job{assigned === 1 ? "" : "s"}
                    </small>
                  )}
                </button>
              );
            })}
          </div>

          <div className="booking-calendar-legend">
            <span>
              <i className="calendar-dot is-partial" />
              My assigned work
            </span>

            <span>
              <i
                className="calendar-dot"
                style={{ backgroundColor: "#cbd5e1" }}
              />
              No assigned work
            </span>
          </div>

          <div className="booking-manage__toolbar">
            <button
              type="button"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh my schedule
            </button>
          </div>

          {loading && <p role="status">Loading your assigned appointments…</p>}
        </section>

        <section className="booking-manage__panel">
          <h2>{date || "Select a date"}</h2>

          {date && chosenJobs.length === 0 && (
            <p>No pending or assigned jobs on this date.</p>
          )}

          {chosenJobs.map((job) => (
            <article className="booking-manage__row" key={job.id}>
              <div>
                <strong>
                  {displayTime(job.start)} · {job.reference}
                </strong>

                <small>
                  {job.workType} ·{" "}
                  {job.status === "PENDING"
                    ? "Pending assigned work"
                    : job.status === "ASSIGNED"
                      ? "Assigned · awaiting start"
                      : job.status === "IN_PROGRESS"
                        ? "In progress"
                        : job.status}
                </small>

                <small>
                  Team {job.teamLeader || "Unassigned"} ·{" "}
                  {job.teamMembers || "Not recorded"}
                </small>

                <small>
                  {job.customer} · {job.address}
                </small>

                {job.destinationAddress && (
                  <small>
                    Destination / install at: {job.destinationAddress}
                  </small>
                )}

                {job.phone && <small>Contact: {job.phone}</small>}

                <button
                  type="button"
                  className="av-schedule-history"
                  onClick={() => setHistoryJob(job)}
                >
                  <History size={15} aria-hidden="true" />
                  View history &amp; notes
                </button>
              </div>
            </article>
          ))}

          <h2>My upcoming assigned jobs</h2>

          {upcoming.length === 0 ? (
            <p>No upcoming jobs assigned to you.</p>
          ) : (
            upcoming.map((job) => (
              <div className="booking-manage__row" key={`up-${job.id}`}>
                <div>
                  <strong>
                    {job.date} · {displayTime(job.start)}
                  </strong>

                  <small>
                    {job.reference} · {job.workType} · {job.status}
                  </small>

                  <button
                    type="button"
                    className="av-schedule-history"
                    onClick={() => setHistoryJob(job)}
                  >
                    <History size={15} aria-hidden="true" />
                    View history &amp; notes
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {historyJob && (
        <WorkHistoryModal
          jobs={[historyJob]}
          customer={historyJob.customer || historyJob.reference}
          onClose={() => setHistoryJob(null)}
        />
      )}
    </main>
  );
}
