import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { History, LockKeyhole, X } from "lucide-react";

import ServiceActivityHistory from "./ServiceActivityHistory.jsx";
import "../../styles/management/service-history-modal.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ServiceHistoryModal({ requestId, customer, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(FOCUSABLE) || [],
      ).filter((element) => element.getClientRects().length > 0);

      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement;

      if (
        event.shiftKey &&
        (focused === first || !dialogRef.current?.contains(focused))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (focused === last || !dialogRef.current?.contains(focused))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (
        previousFocus?.isConnected &&
        typeof previousFocus.focus === "function"
      ) {
        previousFocus.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className="av-history-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="av-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-history-modal-heading"
        aria-describedby="av-history-modal-subtitle"
        tabIndex={-1}
      >
        <header className="av-history-modal__header">
          <div className="av-history-modal__header-icon" aria-hidden="true">
            <History size={22} />
          </div>

          <div className="av-history-modal__title">
            <p className="av-history-modal__eyebrow">SERVICE #{requestId}</p>

            <h2 id="av-history-modal-heading">Service history</h2>

            <p id="av-history-modal-subtitle">
              {customer || "Customer"} · Activities &amp; staff notes
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="av-history-modal__close"
            onClick={onClose}
            aria-label="Close service history"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="av-history-modal__content">
          <ServiceActivityHistory requestId={requestId} />
        </div>

        <footer className="av-history-modal__footer">
          <p>
            <LockKeyhole size={15} aria-hidden="true" />
            Private notes are only for authorized staff.
          </p>

          <button
            type="button"
            className="av-history-modal__done"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
