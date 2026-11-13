import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";
import { BellRing, CalendarClock, Clock3, X } from "lucide-react";

import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import "../../styles/management/upcoming-agenda.css";

function millisecondsUntil(start) {
  if (
    typeof start !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)
  ) {
    return NaN;
  }

  const timestamp = Date.parse(`${start}:00+08:00`);

  return Number.isFinite(timestamp) ? timestamp - Date.now() : NaN;
}

function reminderKey(staffId, item, period) {
  return `av-agenda-dismissed:${staffId}:${item.kind}:${item.id}:${item.scheduledStart}:${period}`;
}

function dismissedInStorage(key) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export default function UpcomingAgendaAlerts({ staff }) {
  const [agenda, setAgenda] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [minuteTick, setMinuteTick] = useState(0);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  useRealtimeRefresh(["schedules", "jobs", "orders", "services"], setRefresh);

  useEffect(() => {
    if (!staff?.id) return undefined;

    const controller = new AbortController();

    api
      .get("/api/management/schedule/upcoming", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setAgenda(Array.isArray(data.agenda) ? data.agenda : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAgenda([]);
        }
      });

    return () => controller.abort();
  }, [staff?.id, refresh]);

  useEffect(() => {
    const onStaffChange = () => {
      setRefresh((value) => value + 1);
    };

    window.addEventListener("av-management-updated", onStaffChange);

    // Only update the displayed countdown.
    // No unnecessary API request every minute.
    const clock = window.setInterval(() => {
      setMinuteTick((value) => value + 1);
    }, 60000);

    return () => {
      window.removeEventListener("av-management-updated", onStaffChange);

      window.clearInterval(clock);
    };
  }, []);

  const upcoming = useMemo(
    () =>
      agenda
        .map((item) => {
          const ms = millisecondsUntil(item.scheduledStart);

          const period =
            ms > 0 && ms <= 2 * 3600000
              ? "2h"
              : ms > 0 && ms <= 24 * 3600000
                ? "24h"
                : null;

          const key = period ? reminderKey(staff.id, item, period) : null;

          const minutes = Math.ceil(ms / 60000);

          return {
            ...item,
            period,
            key,
            minutes,
          };
        })
        .filter(
          (item) =>
            item.period &&
            !dismissed.has(item.key) &&
            !dismissedInStorage(item.key),
        )
        .sort((a, b) => a.minutes - b.minutes)
        .slice(0, 4),
    [agenda, dismissed, minuteTick, staff?.id],
  );

  const dismiss = useCallback((item) => {
    try {
      window.localStorage.setItem(item.key, "1");
    } catch {
      // Keep dismissal in current tab.
    }

    setDismissed((previous) => new Set([...previous, item.key]));
  }, []);

  if (!upcoming.length) {
    return null;
  }

  return (
    <aside
      className={`av-agenda-alerts ${showAllAlerts ? "is-expanded" : ""}`}
      aria-label="Upcoming schedule reminders"
      aria-live="polite"
    >
      {upcoming.map((item) => (
        <section
          className={`av-agenda-alert ${
            item.period === "2h" ? "is-urgent" : "is-upcoming"
          }`}
          key={item.key}
        >
          <span className="av-agenda-alert__icon" aria-hidden="true">
            {item.period === "2h" ? (
              <BellRing size={22} />
            ) : (
              <CalendarClock size={22} />
            )}
          </span>

          <div className="av-agenda-alert__copy">
            <div className="av-agenda-alert__headline">
              <strong>
                {item.period === "2h"
                  ? "URGENT · Appointment within 2 hours"
                  : "Appointment within 24 hours"}
              </strong>

              <span className="av-agenda-alert__time">
                <Clock3 size={14} />

                {item.minutes >= 60
                  ? `${Math.floor(item.minutes / 60)}h ${
                      item.minutes % 60
                    }m remaining`
                  : `${item.minutes}m remaining`}
              </span>
            </div>

            <p>
              {item.kind === "UNAVAILABLE"
                ? `Unavailable: ${item.reason || "Scheduled time off"}`
                : `${String(item.type || "SERVICE").replaceAll(
                    "_",
                    " ",
                  )} job #${item.id}`}{" "}
              · {String(item.scheduledStart || "").replace("T", " at ")} (PH
              time)
            </p>

            <Link
              to="/management/booking-calendar"
              className="av-agenda-alert__cta"
            >
              View calendar
            </Link>
          </div>

          <button
            className="av-agenda-alert__dismiss"
            type="button"
            onClick={() => dismiss(item)}
            aria-label={`Dismiss appointment reminder for job ${item.id}`}
            title="Dismiss this reminder"
          >
            <X size={18} />
          </button>
        </section>
      ))}

      {upcoming.length > 1 && (
        <button
          type="button"
          className="av-agenda-alerts__toggle"
          aria-expanded={showAllAlerts}
          onClick={() => setShowAllAlerts((value) => !value)}
        >
          {showAllAlerts
            ? "Show fewer reminders"
            : `See all ${upcoming.length} reminders`}
        </button>
      )}
    </aside>
  );
}
