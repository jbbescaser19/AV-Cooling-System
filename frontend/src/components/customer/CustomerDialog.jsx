import { X } from "lucide-react";

export default function CustomerDialog({ title, onClose, children }) {
  return (
    <div
      className="customer-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="customer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="customer-dialog-head">
          <h2>{title}</h2>

          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}
