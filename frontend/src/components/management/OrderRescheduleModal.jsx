import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, X } from "lucide-react";
import AvailabilityPicker from "../scheduling/AvailabilityPicker.jsx";
import "../../styles/management/order-reschedule.css";

export default function OrderRescheduleModal({
  reference,
  currentSchedule,
  busy,
  error,
  onSave,
  onClose,
}) {
  const [nextSchedule, setNextSchedule] = useState("");
  const [reason, setReason] = useState("");
  const closeButton = useRef(null);
  const closeRef = useRef(onClose);
  const panelRef = useRef(null);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...(panelRef.current?.querySelectorAll(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) || []),
      ].filter((el) => el.getClientRects().length);
      if (!elements.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  const valid = Boolean(
    nextSchedule &&
    nextSchedule !== currentSchedule &&
    reason.trim().length >= 5,
  );
  return createPortal(
    <div
      className="av-reschedule-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-reschedule-title"
        className="av-reschedule-modal"
        tabIndex={-1}
      >
        <header className="av-reschedule-modal__header">
          <span className="av-reschedule-modal__icon">
            <CalendarClock size={22} />
          </span>
          <div>
            <span className="av-reschedule-modal__eyebrow">
              ORDER APPOINTMENT
            </span>
            <h2 id="av-reschedule-title">Reschedule order</h2>
            <p>{reference}</p>
          </div>
          <button
            ref={closeButton}
            className="av-reschedule-modal__close"
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="av-reschedule-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) onSave(nextSchedule, reason);
          }}
        >
          <div className="av-reschedule-modal__body">
            <div className="av-reschedule-modal__current">
              <span>Current appointment</span>
              <strong>
                {String(currentSchedule || "Not scheduled").replace(
                  "T",
                  " at ",
                )}{" "}
                (PH time)
              </strong>
            </div>
            <p className="av-reschedule-modal__hint">
              Confirm the new schedule with the customer before saving. The old
              reservation is released only when the change succeeds.
            </p>
            <AvailabilityPicker
              label="New appointment"
              value={nextSchedule}
              onChange={setNextSchedule}
              disabled={busy}
            />
            <label className="av-reschedule-modal__reason">
              <span>Reason for change (required)</span>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder="Explain why the appointment is changing."
              />
            </label>
            {error && (
              <p className="av-reschedule-modal__error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="av-reschedule-modal__footer">
            <button
              type="button"
              className="av-reschedule-modal__secondary"
              disabled={busy}
              onClick={onClose}
            >
              Keep current slot
            </button>
            <button
              className="av-reschedule-modal__primary"
              type="submit"
              disabled={!valid || busy}
            >
              <Check size={17} />
              {busy ? "Saving…" : "Save new appointment"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
