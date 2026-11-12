import { useEffect, useMemo, useState } from "react";
import api from "../../../api/api.js";
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
  const [blocks, setBlocks] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/management/schedule/my-calendar", {
        params: { month },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setJobs(data.jobs || []);
          setBlocks(data.blocks || []);
          setUpcoming(data.upcoming || []);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setJobs([]);
          setBlocks([]);
          setUpcoming([]);
          setError(
            err.response?.data?.message || "Unable to load your schedule.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, revision]);

  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener("av-management-updated", refresh);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", visible);
    return () => {
      window.removeEventListener("av-management-updated", refresh);
      window.removeEventListener("focus", visible);
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
  const chosenJobs = jobs.filter((j) => j.date === date);
  const chosenBlocks = blocks.filter((b) => b.date === date);

  return (
    <main className="booking-manage">
      <header>
        <h1>My Team Booking Calendar</h1>
        <p className="booking-manage__intro">
          Your assigned service, installation and delivery jobs only. Other
          teams' bookings are private.
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
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d} className="booking-picker__weekday">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const assigned = jobs.filter((j) => j.date === day).length;
              const off = blocks.some((b) => b.date === day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={date === day}
                  className={`booking-picker__day ${date === day ? "is-selected" : ""} ${off ? "is-full" : assigned ? "is-partial" : "is-available"}`}
                  aria-label={`${day}: ${assigned} team job(s)${off ? ", unavailable period" : ""}`}
                  onClick={() => setDate(day)}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
          <div className="booking-calendar-legend">
            <span>
              <i className="calendar-dot is-partial" /> Your team has work
            </span>
            <span>
              <i className="calendar-dot is-full" /> Your unavailable day/time
            </span>
            <span>
              <i className="calendar-dot is-available" /> No team jobs
            </span>
          </div>
          <div className="booking-manage__toolbar">
            <button
              type="button"
              disabled={loading}
              onClick={() => setRevision((v) => v + 1)}
            >
              Refresh my schedule
            </button>
          </div>
          {loading && <p role="status">Loading your team schedule…</p>}
        </section>
        <section className="booking-manage__panel">
          <h2>{date || "Select a date"}</h2>
          {chosenJobs.length === 0 && chosenBlocks.length === 0 && (
            <p>No jobs or unavailable periods for your team on this date.</p>
          )}
          {chosenJobs.map((job) => (
            <article className="booking-manage__row" key={job.id}>
              <div>
                <strong>
                  {displayTime(job.start)} · {job.reference}
                </strong>
                <small>
                  {job.workType} · {job.status}
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
              </div>
            </article>
          ))}
          {chosenBlocks.map((block, i) => (
            <article className="booking-manage__row" key={`${block.date}-${i}`}>
              <div>
                <strong style={{ color: "#b91c1c" }}>
                  Unavailable:{" "}
                  {block.start
                    ? `${displayTime(block.start)} – ${displayTime(block.end)}`
                    : "All day"}
                </strong>
                <small>{block.reason}</small>
              </div>
            </article>
          ))}
          <h2>Upcoming team jobs</h2>
          {upcoming.length === 0 ? (
            <p>No upcoming assigned jobs.</p>
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
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
