import { useEffect, useId, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { AlertTriangle, Archive, Trash2, X } from "lucide-react";

import api from "../../../api/api.js";

import { getStaff } from "../../utils/authMock";

import DeleteCustomerAccountAction from "./DeleteCustomerAccountAction.jsx";
import DeleteStaffAccountAction from "./DeleteStaffAccountAction.jsx";

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

const STOCK_MODULES = new Set(["products", "variants", "inventory"]);

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

function stockCount(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const count = Number(value);

  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function stockBlockReason(module, record) {
  if (!STOCK_MODULES.has(module)) {
    return "";
  }

  const onHand = stockCount(record?.onHand);

  const reserved = stockCount(record?.reserved);

  if (onHand === null || reserved === null) {
    return "Refresh to check stock.";
  }

  if (reserved > 0) {
    return `${reserved} reserved. ${onHand} on hand.`;
  }

  if (onHand > 0) {
    return `${onHand} ${
      onHand === 1 ? "unit remains" : "units remain"
    } in stock.`;
  }

  return "";
}

/**
 * Catalog archiving remains separate from account deletion.
 * Customer and Staff account closure use dedicated Owner-only
 * backend endpoints, confirmation previews, and password checks.
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

  const [conflict, setConflict] = useState(false);

  const reasonId = useId();

  const headingId = useId();

  const descriptionId = useId();

  const confirmRef = useRef(null);

  const triggerRef = useRef(null);

  const keepRef = useRef(null);

  const dialogRef = useRef(null);

  const busyRef = useRef(false);

  busyRef.current = busy;

  const recordId = Number(record?.id);

  const blockedReason = stockBlockReason(module, record);

  const stockBlocked = Boolean(blockedReason);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (confirmRef.current?.disabled) {
      keepRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }

    function onDialogKeyDown(event) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        setOpen(false);
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const controls = [...dialog.querySelectorAll("button:not(:disabled)")];

      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

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

  const isOwner = canArchive && getStaff()?.role === "OWNER";

  if (module === "customers") {
    return isOwner ? (
      <DeleteCustomerAccountAction
        customer={record}
        isOwner
        onDeleted={onArchived}
      />
    ) : null;
  }

  if (module === "staff") {
    return isOwner ? (
      <DeleteStaffAccountAction staff={record} isOwner onDeleted={onArchived} />
    ) : null;
  }

  if (!canArchive || !ALLOWED_MODULES.has(module)) {
    return null;
  }

  if (!Number.isSafeInteger(recordId) || recordId < 1) {
    return null;
  }

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
    if (busyRef.current || stockBlocked || isFacebookIneligible || conflict) {
      return;
    }

    busyRef.current = true;

    setBusy(true);

    setError("");

    try {
      const { data } = await api.post(
        `/api/management/workspace/archive/${encodeURIComponent(
          archiveModule,
        )}/${recordId}`,

        module === "inventory" ? { origin: "inventory" } : {},
      );

      if (data?.success !== true) {
        throw new Error("Archiving was not confirmed by the server.");
      }

      setOpen(false);

      onArchived?.(data.message || `${label} moved to Archive.`);
    } catch (requestError) {
      const status = requestError.response?.status;

      const message =
        requestError.response?.data?.message ||
        requestError.message ||
        "Could not move this record to Archive.";

      if (status === 409 && STOCK_MODULES.has(module)) {
        setConflict(true);

        setError(
          `${message} Close this window and refresh the records before trying again.`,
        );
      } else {
        setError(message);
      }
    } finally {
      busyRef.current = false;

      setBusy(false);
    }
  }

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      className="av-delete-to-archive wsm-row-action"
      disabled={stockBlocked || busy}
      aria-describedby={stockBlocked ? reasonId : undefined}
      onClick={() => {
        if (stockBlocked || busy) {
          return;
        }

        setError("");

        setConflict(false);

        setOpen(true);
      }}
      aria-label={
        stockBlocked
          ? `Cannot archive ${label}: ${blockedReason}`
          : `Delete ${label} and move to Archive`
      }
      title={
        stockBlocked
          ? `Cannot archive: ${blockedReason}`
          : "Delete (move to Archive)"
      }
      style={
        stockBlocked
          ? {
              opacity: 0.5,
              cursor: "not-allowed",
            }
          : undefined
      }
    >
      <Trash2 size={15} aria-hidden="true" />
      Delete
    </button>
  );

  return (
    <>
      {stockBlocked ? (
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
            maxWidth: "9rem",
          }}
        >
          {triggerButton}

          <small
            id={reasonId}
            style={{
              display: "block",
              color: "#92400e",
              fontSize: "0.68rem",
              fontWeight: 500,
              lineHeight: 1.4,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              textAlign: "center",
            }}
          >
            {blockedReason}
          </small>
        </div>
      ) : (
        triggerButton
      )}

      {open &&
        createPortal(
          <div
            className="av-archive-confirm-backdrop"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !busy) {
                setOpen(false);
              }
            }}
          >
            <section
              ref={dialogRef}
              className="av-archive-confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={headingId}
              aria-describedby={descriptionId}
            >
              <div className="av-archive-confirm-heading">
                <span className="av-archive-confirm-symbol">
                  <Archive size={19} aria-hidden="true" />
                </span>

                <div>
                  <small>AV COOLING · MANAGEMENT</small>

                  <h2 id={headingId}>Move to Archive?</h2>
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
                <p id={descriptionId}>
                  The {type} <strong>{label}</strong> will disappear from active
                  Management lists and appear under{" "}
                  <strong>Management → Archive</strong>. It can be restored from
                  there.
                </p>

                <p className="av-archive-confirm-note">
                  <AlertTriangle size={17} aria-hidden="true" />

                  <span>{RULES[module]}</span>
                </p>

                {STOCK_MODULES.has(module) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    {[
                      {
                        label: "On-hand stock",
                        value: stockCount(record?.onHand),
                      },
                      {
                        label: "Reserved stock",
                        value: stockCount(record?.reserved),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: "grid",
                          gap: 5,
                          minWidth: 0,
                          padding: 10,
                          border: "1px solid #dce7ed",
                          borderRadius: 9,
                          background: "#f8fbfc",
                        }}
                      >
                        <small
                          style={{
                            fontSize: "0.73rem",
                            color: "#547588",
                          }}
                        >
                          {item.label}
                        </small>

                        <strong
                          style={{
                            fontSize: "1.05rem",
                            color:
                              item.value === null
                                ? "#92400e"
                                : item.value > 0
                                  ? "#a33743"
                                  : "#16734b",
                          }}
                        >
                          {item.value === null
                            ? "Unknown"
                            : `${item.value} ${
                                item.value === 1 ? "unit" : "units"
                              }`}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                {stockBlocked && (
                  <p className="av-archive-confirm-error" role="alert">
                    Cannot archive: {blockedReason} Resolve the inventory before
                    continuing.
                  </p>
                )}

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
                  ref={keepRef}
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
                  disabled={
                    busy || stockBlocked || isFacebookIneligible || conflict
                  }
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
