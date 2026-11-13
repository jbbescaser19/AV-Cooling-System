import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** Native modal sits in the browser top layer, above the fixed account header. */
export default function OrderDialog({
  title,
  onClose,
  busy = false,
  footer,
  children,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="order-details-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <header className="order-details-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="order-details-dialog-close"
          aria-label="Close order details"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="order-details-dialog-body">{children}</div>
      {footer && (
        <footer className="order-details-dialog-footer">{footer}</footer>
      )}
    </dialog>
  );
}
