import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  CheckCircle2,
  History,
  LockKeyhole,
  X,
} from "lucide-react";
import api from "../../../api/api.js";
import ServiceActivityHistory from "./ServiceActivityHistory.jsx";
import "../../styles/management/work-history-modal.css";

function when(value) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
export default function WorkHistoryModal({
  jobs = [],
  customer,
  serviceRequestId,
  onClose,
}) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const closeHandler = useRef(onClose);
  useEffect(() => {
    closeHandler.current = onClose;
  }, [onClose]);
  const ids = jobs.map((job) => Number(job.id)).filter(Boolean);
  const key = ids.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all(
      ids.map((id) =>
        api.get(`/api/management/workspace/work-orders/${id}/history`, {
          signal: controller.signal,
        }),
      ),
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setEvents(
          result
            .flatMap(({ data }) =>
              (data.events || []).map((event) => ({
                ...event,
                workType: data.record?.workType,
              })),
            )
            .sort(
              (a, b) =>
                new Date(b.changedAt).getTime() -
                new Date(a.changedAt).getTime(),
            ),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason.response?.data?.message || "Unable to load job history.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // ids are stable for this opened work group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const lastFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandler.current?.();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialog.current?.querySelectorAll(
          'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ) || []),
      ].filter((el) => el.getClientRects().length);
      if (!focusable.length) {
        event.preventDefault();
        dialog.current?.focus();
        return;
      }
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocus?.isConnected && lastFocus.focus?.();
    };
  }, []);
  return createPortal(
    <div
      className="av-work-history-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        className="av-work-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-work-history-heading"
      >
        <header>
          <span className="av-work-history-icon">
            <History size={23} />
          </span>
          <div>
            <small>WORK ACTIVITY</small>
            <h2 id="av-work-history-heading">Job history & notes</h2>
            <p>{customer || "Customer"} · Delivery, installation or service</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close history"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="av-work-history-body">
          <h3>Recorded work progress</h3>
          {loading ? (
            <p role="status">Loading job history…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !events.length ? (
            <p>No changes recorded yet.</p>
          ) : (
            <ol className="av-work-history-timeline">
              {events.map((event, i) => (
                <li key={`${event.workType}-${event.id}-${i}`}>
                  <div className="av-work-history-dot">
                    <CheckCircle2 size={16} />
                  </div>
                  <article>
                    <div>
                      <strong>
                        {String(event.workType).replaceAll("_", " ")} ·{" "}
                        {String(event.newStatus).replaceAll("_", " ")}
                      </strong>
                      <time>{when(event.changedAt)}</time>
                    </div>
                    <small>
                      {event.staffName || "Staff"} ·{" "}
                      {String(event.staffRole || "STAFF").replaceAll("_", " ")}
                    </small>
                    {event.notes && (
                      <p className="av-work-history-note">{event.notes}</p>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
          {serviceRequestId && (
            <div className="av-work-history-service">
              <div className="av-work-history-service-title">
                <LockKeyhole size={17} />
                <h3>Service activity & private staff notes</h3>
              </div>
              <ServiceActivityHistory requestId={serviceRequestId} />
            </div>
          )}
        </div>
        <footer>
          <span>
            <CalendarClock size={15} /> Changes are saved with staff and time.
          </span>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
