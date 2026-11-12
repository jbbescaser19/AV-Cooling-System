import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";

import api from "../../../api/api.js";

const actionLabel = (code) =>
  String(code || "ACTIVITY_RECORDED")
    .replace(/^SERVICE_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function dateLabel(value) {
  if (!value) return "Unknown date";

  const date = new Date(String(value).replace(" ", "T"));

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

/**
 * Private Management API.
 * The backend verifies the assigned technician.
 */
export default function ServiceActivityHistory({ requestId }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!requestId) return undefined;

    const controller = new AbortController();

    setStatus("loading");

    api
      .get(
        `/api/management/services/${encodeURIComponent(requestId)}/activity`,
        {
          signal: controller.signal,
        },
      )
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        setEvents(Array.isArray(data.events) ? data.events : []);

        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [requestId, revision]);

  if (status === "loading") {
    return (
      <div className="av-history-state" role="status">
        <RefreshCw
          className="av-history-state__spin"
          size={25}
          aria-hidden="true"
        />

        <h3>Loading activity</h3>

        <p>Retrieving the service history and notes.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="av-history-state" role="alert">
        <AlertCircle size={28} aria-hidden="true" />

        <h3>History could not be loaded</h3>

        <p>Please check your connection and try again.</p>

        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw size={15} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="av-history-state">
        <ClipboardList size={28} aria-hidden="true" />

        <h3>No activity recorded yet</h3>

        <p>Updates and notes will appear here when staff record them.</p>
      </div>
    );
  }

  return (
    <section
      className="av-history-activity"
      aria-label="Service activity timeline"
    >
      <div className="av-history-activity__heading">
        <div>
          <h3>Activity timeline</h3>
          <p>Newest updates first</p>
        </div>

        <span>
          {events.length} {events.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <ol className="av-history-activity__list">
        {events.map((entry) => (
          <li key={entry.id} className="av-history-activity__item">
            <div className="av-history-activity__dot" aria-hidden="true" />

            <article className="av-history-activity__card">
              <div className="av-history-activity__card-head">
                <h4>{actionLabel(entry.code)}</h4>

                <time dateTime={entry.createdAt || undefined}>
                  {dateLabel(entry.createdAt)}
                </time>
              </div>

              <div className="av-history-activity__person">
                <strong>{entry.staffName || "Deleted staff account"}</strong>

                <span>
                  {String(entry.staffRole || "STAFF").replaceAll("_", " ")}
                </span>
              </div>

              {entry.schedule && (
                <div className="av-history-activity__schedule">
                  <CalendarDays size={16} aria-hidden="true" />

                  <span>
                    Appointment: {String(entry.schedule).replace("T", " at ")}
                  </span>
                </div>
              )}

              {entry.customerReason && (
                <div className="av-history-activity__note av-history-activity__note--reason">
                  <h5>Customer-visible reason</h5>

                  <p>{entry.customerReason}</p>
                </div>
              )}

              {entry.internalNote && (
                <div className="av-history-activity__note av-history-activity__note--private">
                  <h5>
                    <LockKeyhole size={14} aria-hidden="true" />
                    Private staff note
                  </h5>

                  <p>{entry.internalNote}</p>
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
