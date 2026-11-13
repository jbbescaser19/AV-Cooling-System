import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, X } from "lucide-react";

/**
 * Read-only details for a Management table record.
 * Portalled to document.body, so sidebar/header overflow cannot clip it.
 * Edit, confirmation and archive actions remain in their existing components.
 */
export default function ManagementRecordDetailsModal({
  title,
  subtitle,
  fields,
  onClose,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const dismissRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    dismissRef.current?.focus();

    function onKeyDown(event) {
      // Archive has its own higher-level confirmation and keyboard handling.
      if (document.querySelector(".av-archive-confirm-backdrop")) return;
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...panel.querySelectorAll(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="av-record-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="av-record-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="av-record-modal__header">
          <span className="av-record-modal__symbol">
            <ClipboardList size={19} aria-hidden="true" />
          </span>
          <div className="av-record-modal__heading">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{subtitle}</p>
          </div>
          <button
            ref={dismissRef}
            type="button"
            className="av-record-modal__dismiss"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="av-record-modal__content">
          <dl className="av-record-modal__fields">
            {fields.map(({ label, value }, index) => (
              <div className="av-record-modal__field" key={`${label}-${index}`}>
                <dt>{label}</dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="av-record-modal__footer">
          {children ? (
            <div className="av-record-modal__actions">{children}</div>
          ) : null}
          <button
            type="button"
            className="av-record-modal__close"
            onClick={onClose}
          >
            Close Details
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
