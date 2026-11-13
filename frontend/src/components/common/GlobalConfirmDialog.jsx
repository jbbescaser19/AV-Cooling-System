import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, X } from "lucide-react";
import "../../styles/shared/confirmation-dialog.css";

export default function GlobalConfirmDialog() {
  const [queue, setQueue] = useState([]);
  const confirmRef = useRef(null);
  const previousFocus = useRef(null);
  const active = queue[0];

  useEffect(() => {
    function request(event) {
      event.preventDefault();
      setQueue((items) => [...items, event.detail]);
    }
    window.addEventListener("av-confirm-request", request);
    return () => window.removeEventListener("av-confirm-request", request);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    previousFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        active.settle(false);
        setQueue((items) => items.slice(1));
      }
      if (event.key === "Tab") {
        const controls = confirmRef.current
          ?.closest("[role=dialog]")
          ?.querySelectorAll("button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus?.();
    };
  }, [active]);

  function decide(value) {
    if (!active) return;
    active.settle(value);
    setQueue((items) => items.slice(1));
  }

  if (!active) return null;
  return createPortal(
    <div className="av-confirm-layer">
      <div
        className="av-confirm-backdrop"
        onClick={() => decide(false)}
        aria-hidden="true"
      />
      <section
        className="av-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-confirm-title"
        aria-describedby="av-confirm-message"
      >
        <div className="av-confirm-head">
          <span
            className={`av-confirm-symbol ${active.tone === "caution" ? "is-caution" : ""}`}
          >
            <AlertCircle size={23} />
          </span>
          <button
            className="av-confirm-icon-btn"
            type="button"
            onClick={() => decide(false)}
            aria-label="Close confirmation"
          >
            <X size={19} />
          </button>
        </div>
        <h2 id="av-confirm-title">{active.title}</h2>
        <p id="av-confirm-message">{active.message}</p>
        <div className="av-confirm-actions">
          <button
            type="button"
            className="av-confirm-cancel"
            onClick={() => decide(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="av-confirm-accept"
            ref={confirmRef}
            onClick={() => decide(true)}
          >
            <Check size={17} />
            {active.confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
