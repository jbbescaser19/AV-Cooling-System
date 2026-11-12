import { useEffect, useMemo, useState } from "react";
import api from "../../../api/api.js";
import "../../styles/management/booking-calendar.css";

const manilaMonth = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);

const formatMonth = (month) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

const shiftMonth = (month, step) => {
  const [year, m] = month.split("-").map(Number);

  return new Date(Date.UTC(year, m - 1 + step, 1)).toISOString().slice(0, 7);
};

export default function AvailabilityPicker({
  value = "",
  onChange,
  disabled = false,
  allowExistingValue = false,
  existingValue = "",
  optional = false,
  label = "Appointment date and time",
}) {
  const [month, setMonth] = useState(() => value?.slice(0, 7) || manilaMonth());

  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedDate = value?.slice(0, 10) || "";

  const [focusedDate, setFocusedDate] = useState(() => selectedDate || "");

  const [revision, setRevision] = useState(0);

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
          setDays(data.days || []);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDays([]);
          setError(
            err.response?.data?.message || "Calendar unavailable. Try again.",
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
    if (!value) return;

    const wantedMonth = value.slice(0, 7);

    if (wantedMonth) {
      setMonth(wantedMonth);
    }

    setFocusedDate(value.slice(0, 10));
  }, [value]);

  const firstWeekday = useMemo(
    () => new Date(`${month}-01T00:00:00Z`).getUTCDay(),
    [month],
  );

  const day = days.find((entry) => entry.date === focusedDate);

  const minMonth = manilaMonth();
  const maxMonth = shiftMonth(minMonth, 5);

  const chosenValue = value?.slice(0, 16) || "";

  const persisted = (existingValue || (allowExistingValue ? value : "")).slice(
    0,
    16,
  );

  const choosingExisting = (option) =>
    allowExistingValue && persisted === `${focusedDate}T${option.start}`;

  return (
    <div className="booking-picker" aria-label={label}>
      <div className="booking-picker__heading">
        <strong>{label}</strong>

        <button
          type="button"
          className="booking-picker__refresh"
          disabled={disabled}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          Refresh slots
        </button>
      </div>

      <div className="booking-picker__month">
        <button
          type="button"
          aria-label="Previous month"
          disabled={disabled || month <= minMonth}
          onClick={() => {
            setMonth(shiftMonth(month, -1));
            setFocusedDate("");
            setLoading(true);
          }}
        >
          ‹
        </button>

        <strong>{formatMonth(month)}</strong>

        <button
          type="button"
          aria-label="Next month"
          disabled={disabled || month >= maxMonth}
          onClick={() => {
            setMonth(shiftMonth(month, 1));
            setFocusedDate("");
            setLoading(true);
          }}
        >
          ›
        </button>
      </div>

      <div
        className="booking-picker__grid"
        role="group"
        aria-label="Choose a date"
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
          <span className="booking-picker__weekday" key={name}>
            {name}
          </span>
        ))}

        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {days.map((entry) => {
          const remaining = entry.slots.reduce(
            (sum, slot) =>
              sum + (slot.available ? slot.capacity - slot.booked : 0),
            0,
          );

          const canOpen =
            remaining > 0 ||
            (allowExistingValue && persisted.slice(0, 10) === entry.date);

          const hasBooked = entry.slots.some((slot) => Number(slot.booked) > 0);

          const state =
            remaining === 0
              ? "is-full"
              : hasBooked
                ? "is-partial"
                : "is-available";

          return (
            <button
              key={entry.date}
              type="button"
              disabled={disabled || loading || !canOpen}
              aria-pressed={focusedDate === entry.date}
              className={`booking-picker__day ${
                focusedDate === entry.date ? "is-selected" : ""
              } ${state}`}
              onClick={() => setFocusedDate(entry.date)}
              title={
                canOpen ? `${remaining} slot(s) left` : "No available times"
              }
            >
              {Number(entry.date.slice(-2))}
            </button>
          );
        })}
      </div>

      <div className="booking-calendar-legend" aria-label="Availability legend">
        <span>
          <i className="calendar-dot is-available" />
          Available
        </span>

        <span>
          <i className="calendar-dot is-partial" />
          Some booked
        </span>

        <span>
          <i className="calendar-dot is-full" />
          Fully booked / closed
        </span>
      </div>

      {loading && (
        <p className="booking-picker__hint">Checking availability…</p>
      )}

      {error && (
        <p className="booking-picker__error" role="alert">
          {error}
        </p>
      )}

      {day && !loading && (
        <div className="booking-picker__slots">
          <strong>Times for {focusedDate}</strong>

          {day.slots.map((option) => {
            const current = `${focusedDate}T${option.start}`;

            const existing = choosingExisting(option);

            const selectable = option.available || existing;

            return (
              <button
                key={option.start}
                type="button"
                disabled={disabled || !selectable}
                aria-pressed={chosenValue === current}
                className={`booking-picker__slot ${
                  chosenValue === current ? "is-selected" : ""
                }`}
                onClick={() => onChange(current)}
              >
                <span>{option.label}</span>

                <span>
                  {existing && !option.available
                    ? "Your current slot"
                    : option.closed
                      ? "Closed"
                      : option.staffUnavailable
                        ? "Staff unavailable"
                        : option.available
                          ? `${option.capacity - option.booked} left`
                          : "Fully booked"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {optional && value && (
        <button
          className="booking-picker__refresh"
          type="button"
          disabled={disabled}
          onClick={() => onChange("")}
        >
          Remove appointment
        </button>
      )}

      {chosenValue && (
        <p className="booking-picker__hint">
          Selected: <strong>{chosenValue.replace("T", " at ")}</strong>{" "}
          (Philippine time)
        </p>
      )}

      <p className="booking-picker__hint">
        Time slots update as bookings are submitted. Availability is checked
        again when you save.
      </p>
    </div>
  );
}
