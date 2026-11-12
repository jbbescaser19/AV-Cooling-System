import { useEffect, useMemo, useState } from "react";
import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import TechnicianBookingCalendar from "./TechnicianBookingCalendar.jsx";
import "../../styles/management/booking-calendar.css";

const manilaToday = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const currentMonth = () => manilaToday().slice(0, 7);
const monthLabel = (month) =>
  new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
const changeMonth = (value, n) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + n, 1)).toISOString().slice(0, 7);
};

export default function BookingCalendarPage() {
  if (getStaff()?.role === "TECHNICIAN") return <TechnicianBookingCalendar />;
  return <ManagementBookingCalendar />;
}

function ManagementBookingCalendar() {
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(manilaToday);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [dayError, setDayError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  const canManage = ["OWNER", "MANAGER"].includes(getStaff()?.role);
  const today = manilaToday();
  const selected = days.find((item) => item.date === date);
  const isPast = date && date < today;
  const offset = useMemo(
    () => new Date(`${month}-01T00:00:00Z`).getUTCDay(),
    [month],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/schedule/availability", {
        params: { month },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setDays(Array.isArray(data.days) ? data.days : []);
          setCalendarError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDays([]);
          setCalendarError(
            error.response?.data?.message || "Calendar could not load.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, revision]);

  useEffect(() => {
    if (!date) {
      setBookings([]);
      setDayError("");
      return undefined;
    }
    const controller = new AbortController();
    setDayLoading(true);
    setDayError("");
    setBookings([]);
    api
      .get("/api/management/schedule/day", {
        params: { date },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDayError(
            error.response?.data?.message || "Appointments could not load.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDayLoading(false);
      });
    return () => controller.abort();
  }, [date, revision]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(onVisible, 60000);
    window.addEventListener("av-management-updated", refresh);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("av-management-updated", refresh);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function save(endpoint, payload, notice) {
    if (!canManage || saving || isPast) return;
    setSaving(true);
    setDayError("");
    setMessage("");
    try {
      await api.patch(`/api/management/schedule/${endpoint}`, payload);
      setMessage(notice);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (error) {
      setDayError(
        error.response?.data?.message || "Could not save availability.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateSlot(slot, changes) {
    if (!selected) return;
    const capacity = changes.capacity ?? slot.capacity;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) {
      setDayError("Capacity must be a whole number from 1 to 10.");
      return;
    }
    save(
      "slot",
      {
        date,
        start: slot.start,
        capacity,
        closed: changes.closed ?? Boolean(slot.closed),
      },
      "Time slot updated.",
    );
  }

  function changeDate(closed) {
    if (selected)
      save(
        "day",
        { date, closed },
        closed
          ? "Date closed for new bookings."
          : "Date reopened for bookings.",
      );
  }

  return (
    <main className="booking-manage">
      <header>
        <h1>Booking Calendar</h1>
        <p className="booking-manage__intro">
          Shared availability for Ecommerce, Services, POS installations and
          Facebook bookings.
          {canManage
            ? " Close dates or adjust capacity below."
            : " Your access is view-only."}
        </p>
      </header>
      {calendarError && (
        <p role="alert" className="booking-manage__error">
          {calendarError}
        </p>
      )}
      {dayError && (
        <p role="alert" className="booking-manage__error">
          {dayError}
        </p>
      )}
      {message && (
        <p role="status" className="booking-manage__success">
          {message}
        </p>
      )}

      <div className="booking-manage__columns">
        <section
          className="booking-manage__panel"
          aria-label="Monthly calendar"
        >
          <div className="booking-picker__month">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month <= currentMonth()}
              onClick={() => {
                setMonth(changeMonth(month, -1));
                setDate("");
              }}
            >
              ‹
            </button>
            <strong>{monthLabel(month)}</strong>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= changeMonth(currentMonth(), 5)}
              onClick={() => {
                setMonth(changeMonth(month, 1));
                setDate("");
              }}
            >
              ›
            </button>
          </div>
          <div
            className="booking-picker__grid"
            role="group"
            aria-label="Choose a day to inspect"
          >
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((name) => (
              <span className="booking-picker__weekday" key={name}>
                {name}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {days.map((item) => {
              const remaining = item.slots.reduce(
                (sum, slot) =>
                  sum +
                  (slot.available
                    ? Math.max(0, slot.capacity - slot.booked)
                    : 0),
                0,
              );
              const allClosed = item.slots.every((slot) => slot.closed);
              const hasBooked = item.slots.some(
                (slot) => Number(slot.booked) > 0,
              );
              const state =
                remaining === 0
                  ? "is-full"
                  : hasBooked
                    ? "is-partial"
                    : "is-available";
              return (
                <button
                  type="button"
                  key={item.date}
                  onClick={() => {
                    setDate(item.date);
                    setMessage("");
                  }}
                  aria-label={`${item.date}: ${item.date < today ? "Past date" : allClosed ? "Closed" : hasBooked ? `${remaining} available, some booked` : `${remaining} available appointments`}`}
                  aria-pressed={date === item.date}
                  className={`booking-picker__day ${date === item.date ? "is-selected" : ""} ${state}`}
                >
                  {Number(item.date.slice(-2))}
                </button>
              );
            })}
          </div>
          <div
            className="booking-calendar-legend"
            aria-label="Calendar color legend"
          >
            <span>
              <i className="calendar-dot is-available" /> Green · Available
            </span>
            <span>
              <i className="calendar-dot is-partial" /> Orange · Partially
              booked
            </span>
            <span>
              <i className="calendar-dot is-full" /> Red · Full or unavailable
            </span>
          </div>
          {loading && <small role="status">Refreshing calendar…</small>}
          <div className="booking-manage__toolbar">
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              disabled={loading || saving}
            >
              Refresh bookings
            </button>
          </div>
        </section>

        <section
          className="booking-manage__panel"
          aria-label="Selected day bookings"
        >
          {!date ? (
            <p>Select a date to view the booked appointments.</p>
          ) : (
            <>
              <h2>{date}</h2>
              {canManage && selected && !isPast && (
                <div className="booking-manage__toolbar">
                  <button
                    type="button"
                    disabled={saving || loading}
                    onClick={() => changeDate(true)}
                  >
                    Close date
                  </button>
                  <button
                    type="button"
                    disabled={saving || loading}
                    onClick={() => changeDate(false)}
                  >
                    Reopen date
                  </button>
                </div>
              )}
              {!canManage && (
                <small>
                  View only · Only an Owner or Manager can change availability.
                </small>
              )}
              {isPast && <small>Past date · settings are read-only.</small>}
              {selected && (
                <>
                  <h2>Time slots</h2>
                  {selected.slots.map((slot) => (
                    <div key={slot.start} className="booking-manage__row">
                      <div>
                        <strong>{slot.label}</strong>
                        <small>
                          {slot.booked} / {slot.capacity} booked ·{" "}
                          {slot.closed
                            ? "Closed"
                            : slot.staffUnavailable
                              ? "Staff unavailable"
                              : slot.available
                                ? "Available"
                                : "Fully booked or past"}
                        </small>
                      </div>
                      {canManage && !isPast && (
                        <div className="booking-manage__toolbar">
                          <label>
                            Capacity
                            <input
                              type="number"
                              min="1"
                              max="10"
                              aria-label={`Capacity for ${slot.start}`}
                              key={`${date}-${revision}-${slot.start}`}
                              defaultValue={slot.capacity}
                              disabled={saving || loading}
                              onBlur={(event) => {
                                const capacity = Number(event.target.value);
                                if (capacity !== slot.capacity)
                                  updateSlot(slot, { capacity });
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={saving || loading}
                            onClick={() =>
                              updateSlot(slot, {
                                closed: !Boolean(slot.closed),
                              })
                            }
                          >
                            {slot.closed ? "Open" : "Close"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              <h2>
                Booked appointments ({dayLoading ? "…" : bookings.length})
              </h2>
              {dayLoading ? (
                <p role="status">Loading appointments…</p>
              ) : dayError ? null : bookings.length === 0 ? (
                <p>No appointments on this date.</p>
              ) : (
                bookings.map((booking, index) => (
                  <div
                    key={`${booking.kind}-${booking.recordId ?? "private"}-${index}`}
                    className="booking-manage__row"
                  >
                    <div>
                      <strong>
                        {booking.start} ·{" "}
                        {booking.reference || `#${booking.recordId}`}
                      </strong>
                      <small>
                        {booking.kind} · {booking.status}
                      </small>
                      {booking.customer && (
                        <small>
                          {booking.customer}
                          {booking.phone ? ` · ${booking.phone}` : ""}
                        </small>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
