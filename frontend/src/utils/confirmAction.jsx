import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import "../styles/shared/confirm-action-dialog.css";

function ConfirmationDialog({
  title,
  message,
  confirmText,
  danger,
  noticeOnly,
  done,
}) {
  const panel = useRef(null);
  const cancel = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    (cancel.current || panel.current?.querySelector("button"))?.focus();

    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        done(false);
      }
      if (event.key !== "Tab") return;
      const buttons = [...(panel.current?.querySelectorAll("button") || [])];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [done]);

  return (
    <div
      className="av-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) done(false);
      }}
    >
      <section
        ref={panel}
        className="av-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="av-confirm-title"
        aria-describedby="av-confirm-message"
      >
        <header className="av-confirm-header">
          <span className="av-confirm-icon" aria-hidden="true">
            {danger ? <AlertTriangle size={21} /> : <CheckCircle2 size={21} />}
          </span>
          <h2 id="av-confirm-title">{title}</h2>
          <button
            type="button"
            className="av-confirm-close"
            onClick={() => done(false)}
            aria-label="Close confirmation"
          >
            <X size={19} />
          </button>
        </header>
        <p id="av-confirm-message">{message}</p>
        <footer className="av-confirm-actions">
          {!noticeOnly && (
            <button type="button" ref={cancel} onClick={() => done(false)}>
              Go back
            </button>
          )}
          <button
            type="button"
            className={danger ? "av-confirm-danger" : "av-confirm-primary"}
            onClick={() => done(true)}
          >
            {confirmText}
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * An accessible confirmation modal without native window.confirm().
 * Resolves true only when a user explicitly presses the action button.
 */
function openActionModal({
  title = "Confirm action",
  message,
  confirmText = "Confirm",
  danger = false,
  noticeOnly = false,
}) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;

    function done(value) {
      if (settled) return;
      settled = true;
      resolve(Boolean(value));
      // Unmount after React's current click/keydown event has completed.
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(
      <ConfirmationDialog
        title={title}
        message={message}
        confirmText={confirmText}
        danger={danger}
        noticeOnly={noticeOnly}
        done={done}
      />,
    );
  });
}

/** Confirm a potentially consequential action. */
export function confirmAction(options) {
  return openActionModal(options || {});
}

/** One-button accessible information/error modal, never a browser alert. */
export function showActionNotice({ title = "Notice", message }) {
  return openActionModal({
    title,
    message,
    confirmText: "OK",
    noticeOnly: true,
  });
}
