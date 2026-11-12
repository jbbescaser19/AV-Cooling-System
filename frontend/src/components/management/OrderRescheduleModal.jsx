import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, X } from "lucide-react";

import AvailabilityPicker from "../scheduling/AvailabilityPicker.jsx";
import "../../styles/management/order-reschedule.css";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function humanSchedule(value) {
  if (!value) return "Not scheduled";
  return `${value.replace("T", " at ")} (Philippines time)`;
}

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
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const closeCallback = useRef(onClose);

  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        closeCallback.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const candidates = Array.from(
        panelRef.current?.querySelectorAll(FOCUSABLE) || [],
      ).filter((item) => item.getClientRects().length > 0);
      if (!candidates.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !panelRef.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !panelRef.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
    };
  }, []);

  const valid =
    nextSchedule &&
    nextSchedule !== currentSchedule &&
    reason.trim().length >= 5;

  return createPortal(
    <div
      className="av-reschedule-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="av-reschedule-modal"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-reschedule-title"
        aria-describedby="av-reschedule-subtitle"
      >
        <header className="av-reschedule-modal__header">
          <span className="av-reschedule-modal__icon" aria-hidden="true">
            <CalendarClock size={22} />
          </span>
          <div>
            <span className="av-reschedule-modal__eyebrow">
              ORDER APPOINTMENT
            </span>
            <h2 id="av-reschedule-title">Reschedule order</h2>
            <p id="av-reschedule-subtitle">{reference}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="av-reschedule-modal__close"
            aria-label="Close reschedule dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="av-reschedule-modal__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !busy) onSave(nextSchedule, reason);
          }}
        >
          <div className="av-reschedule-modal__body">
            <div className="av-reschedule-modal__current">
              <span>Currently reserved</span>
              <strong>{humanSchedule(currentSchedule)}</strong>
            </div>
            <p className="av-reschedule-modal__hint">
              Confirm the change with the customer first. Select a different
              available appointment; the previous reservation will be released
              only after the new one is saved.
            </p>
            <AvailabilityPicker
              key={currentSchedule}
              label="New appointment date and time"
              value={nextSchedule}
              onChange={setNextSchedule}
              disabled={busy}
            />
            <label className="av-reschedule-modal__reason">
              <span>
                Reason for rescheduling <strong>*</strong>
              </span>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the schedule change to the customer (at least 5 characters)."
              />
              <small>
                This reason is visible in the customer's order notification.
              </small>
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
              type="submit"
              className="av-reschedule-modal__primary"
              disabled={!valid || busy}
            >
              <Check size={17} />{" "}
              {busy ? "Saving new appointment…" : "Save new appointment"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
