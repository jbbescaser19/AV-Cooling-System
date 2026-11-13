import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/archive-record-actions.css";

const ALLOWED_MODULES = new Set([
  "products",
  "categories",
  "variants",
  "inventory",
  "service-types",
  "technicians",
  "facebook-requests",
]);

const LABELS = {
  products: "product",
  categories: "product category",
  variants: "product variant",
  inventory: "inventory variant",
  "service-types": "service type",
  technicians: "technician profile",
  "facebook-requests": "Facebook agreement",
};

const RULES = {
  products:
    "Products with remaining stock or reserved units cannot be archived. Move or resolve the inventory first.",
  categories:
    "A category cannot be archived while it still contains active products.",
  variants:
    "Variants with remaining stock or reserved units cannot be archived.",
  inventory:
    "This removes the product variant from active inventory, not just its stock entry. The on-hand and reserved quantities must both be zero.",
  "service-types": "Existing service and payment history will be kept.",
  technicians:
    "Deactivate the linked staff login and reassign all active jobs first.",
  "facebook-requests":
    "Only cancelled agreements that were never converted to an order or service can be archived.",
};

function nameFor(module, record) {
  return String(
    record?.name ||
      record?.customer ||
      record?.customerName ||
      record?.code ||
      record?.reference ||
      record?.id ||
      LABELS[module] ||
      "this record",
  );
}

/**
 * Archive is deliberately separate from the generic workspace editor.
 * The backend is authoritative for authorization and safety checks.
 * No payments, orders, work history, staff accounts, or audit logs
 * are eligible for this action.
 */
export default function ArchiveRecordAction({
  module,
  record,
  canArchive,
  onArchived,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef(null);
  const triggerRef = useRef(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const recordId = Number(record?.id);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    function onDialogKeyDown(event) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector(".av-archive-confirm-dialog");
      if (!dialog) return;
      const controls = [...dialog.querySelectorAll("button:not(:disabled)")];
      if (controls.length === 0) return;
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
    window.addEventListener("keydown", onDialogKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onDialogKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!canArchive || !ALLOWED_MODULES.has(module)) return null;
  if (!Number.isSafeInteger(recordId) || recordId < 1) return null;

  const type = LABELS[module];
  const label = nameFor(module, record);
  const archiveModule = module === "inventory" ? "variants" : module;
  const isFacebookIneligible =
    module === "facebook-requests" &&
    (String(record.status || "").toUpperCase() !== "CANCELLED" ||
      Boolean(
        record.convertedOrderId ||
        record.convertedServiceRequestId ||
        record.convertedWorkOrderId,
      ));

  async function confirmArchive() {
    if (busy || isFacebookIneligible) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        `/api/management/workspace/archive/${encodeURIComponent(archiveModule)}/${recordId}`,
        module === "inventory" ? { origin: "inventory" } : {},
      );
      if (data?.success !== true)
        throw new Error("Archiving was not confirmed by the server.");
      setOpen(false);
      onArchived?.(data.message || `${label} moved to Archive.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not move this record to Archive.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="av-delete-to-archive wsm-row-action"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label={`Delete ${label} and move to Archive`}
        title="Delete (move to Archive)"
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete
      </button>

      {open &&
        createPortal(
          <div
            className="av-archive-confirm-backdrop"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !busy) setOpen(false);
            }}
          >
            <section
              className="av-archive-confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="av-archive-confirm-heading"
              aria-describedby="av-archive-confirm-description"
            >
              <div className="av-archive-confirm-heading">
                <span className="av-archive-confirm-symbol">
                  <Archive size={19} aria-hidden="true" />
                </span>
                <div>
                  <small>AV COOLING · MANAGEMENT</small>
                  <h2 id="av-archive-confirm-heading">Move to Archive?</h2>
                </div>
                <button
                  type="button"
                  className="av-archive-confirm-dismiss"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  aria-label="Close archive confirmation"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="av-archive-confirm-body">
                <p id="av-archive-confirm-description">
                  The {type} <strong>{label}</strong> will disappear from active
                  Management lists and appear under{" "}
                  <strong>Management → Archive</strong>. It can be restored from
                  there.
                </p>
                <p className="av-archive-confirm-note">
                  <AlertTriangle size={17} aria-hidden="true" />
                  <span>{RULES[module]}</span>
                </p>
                {isFacebookIneligible && (
                  <p className="av-archive-confirm-error" role="alert">
                    Cancel this Facebook agreement first. Converted agreements
                    must stay linked to their saved orders or services.
                  </p>
                )}
                {error && (
                  <p className="av-archive-confirm-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="av-archive-confirm-actions">
                <button
                  type="button"
                  className="av-archive-confirm-cancel"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Keep record
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  className="av-archive-confirm-submit"
                  onClick={confirmArchive}
                  disabled={busy || isFacebookIneligible}
                >
                  <Archive size={16} aria-hidden="true" />
                  {busy ? "Moving…" : "Move to Archive"}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
