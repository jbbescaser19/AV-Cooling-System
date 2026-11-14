import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/delete-customer-account.css";

export default function DeleteCustomerAccountAction({
  customer,
  isOwner,
  onDeleted,
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const busyRef = useRef(false);

  busyRef.current = deleting;

  const id = Number(customer?.id);

  useEffect(() => {
    if (!open) return undefined;

    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        setOpen(false);
      }

      if (event.key !== "Tab") return;

      const inputs = [
        ...(dialogRef.current?.querySelectorAll(
          "button:not([disabled]), input:not([disabled])",
        ) || []),
      ];

      if (!inputs.length) return;

      if (event.shiftKey && document.activeElement === inputs[0]) {
        event.preventDefault();
        inputs.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === inputs.at(-1)) {
        event.preventDefault();
        inputs[0].focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!isOwner || !Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  async function openPreview() {
    setOpen(true);
    setFetching(true);
    setPreview(null);
    setError("");
    setPassword("");
    setConfirmation("");

    try {
      const { data } = await api.get(
        `/api/management/workspace/customers/${id}/deletion-preview`,
      );

      if (!data?.success) {
        throw new Error("Could not check the customer's records.");
      }

      setPreview(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not check this account.",
      );
    } finally {
      setFetching(false);
    }
  }

  async function confirmRemoval(event) {
    event.preventDefault();

    if (
      deleting ||
      !preview?.canDelete ||
      confirmation !== "DELETE" ||
      !password
    ) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const { data } = await api.delete(
        `/api/management/workspace/customers/${id}`,
        {
          data: { confirmation, password },
        },
      );

      if (!data?.success) {
        throw new Error("The server did not confirm account removal.");
      }

      setOpen(false);

      onDeleted?.(data.message || "Customer account deleted.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not remove the account.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="av-customer-delete-trigger wsm-row-action"
        type="button"
        onClick={openPreview}
        aria-label={`Delete customer account ${customer.name}`}
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete Account
      </button>

      {open &&
        createPortal(
          <div
            className="av-customer-delete-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deleting) {
                setOpen(false);
              }
            }}
          >
            <section
              className="av-customer-delete-dialog"
              ref={dialogRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="av-customer-delete-title"
              aria-describedby="av-customer-delete-description"
            >
              <header className="av-customer-delete-header">
                <span className="av-customer-delete-symbol">
                  <ShieldAlert size={21} />
                </span>

                <div>
                  <small>OWNER ONLY · CUSTOMER ACCOUNTS</small>
                  <h2 id="av-customer-delete-title">
                    Delete customer account?
                  </h2>
                </div>

                <button
                  type="button"
                  className="av-customer-delete-close"
                  aria-label="Close confirmation"
                  onClick={() => setOpen(false)}
                  disabled={deleting}
                >
                  <X size={19} />
                </button>
              </header>

              <form onSubmit={confirmRemoval}>
                <div className="av-customer-delete-content">
                  <p id="av-customer-delete-description">
                    You are removing access for{" "}
                    <strong>{preview?.customer?.name || customer.name}</strong>
                    {preview?.customer?.email ? (
                      <> ({preview.customer.email})</>
                    ) : null}
                    . The closure will appear in{" "}
                    <strong>Management → Archive → Customer Accounts</strong>.
                    Login access cannot be restored.
                  </p>

                  {fetching && (
                    <p role="status">
                      Checking orders, services, payments, bookings, and field
                      work…
                    </p>
                  )}

                  {preview && (
                    <>
                      <div className="av-customer-delete-stats">
                        <div>
                          <strong>{preview.summary.ordersToCancel}</strong>
                          <span>Orders to cancel</span>
                        </div>

                        <div>
                          <strong>{preview.summary.servicesToCancel}</strong>
                          <span>Services to cancel</span>
                        </div>
                      </div>

                      <p className="av-customer-delete-muted">
                        Completed and previously cancelled records will be
                        retained:
                        {` ${preview.summary.completedOrCancelledOrdersKept} order(s), `}
                        {`${preview.summary.completedOrCancelledServicesKept} service(s).`}
                      </p>

                      <p className="av-customer-delete-caution">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <span>
                          Eligible pending and confirmed work will be cancelled.
                          Reserved stock and booked slots will be released. The
                          customer will no longer be able to log in. A
                          cancellation summary will be saved in Archive.
                        </span>
                      </p>

                      {!preview.canDelete ? (
                        <div
                          className="av-customer-delete-blockers"
                          role="alert"
                        >
                          <strong>
                            Deletion is blocked until these issues are resolved:
                          </strong>

                          <ul>
                            {preview.blockers.map((message, index) => (
                              <li key={index}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <>
                          <label className="av-customer-delete-label">
                            Type <strong>DELETE</strong> to confirm
                            <input
                              type="text"
                              autoComplete="off"
                              spellCheck={false}
                              value={confirmation}
                              onChange={(event) =>
                                setConfirmation(event.target.value)
                              }
                              placeholder="DELETE"
                              disabled={deleting}
                              required
                            />
                          </label>

                          <label className="av-customer-delete-label">
                            Confirm your Owner password
                            <input
                              type="password"
                              autoComplete="current-password"
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                              placeholder="Owner password"
                              disabled={deleting}
                              required
                            />
                          </label>
                        </>
                      )}
                    </>
                  )}

                  {error && (
                    <p role="alert" className="av-customer-delete-error">
                      {error}
                    </p>
                  )}
                </div>

                <footer className="av-customer-delete-actions">
                  <button
                    type="button"
                    className="av-customer-delete-keep"
                    onClick={() => setOpen(false)}
                    disabled={deleting}
                  >
                    Keep Account
                  </button>

                  <button
                    type="submit"
                    className="av-customer-delete-submit"
                    disabled={
                      deleting ||
                      fetching ||
                      !preview?.canDelete ||
                      confirmation !== "DELETE" ||
                      !password
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {deleting
                      ? "Deleting…"
                      : "Delete Account & Cancel Pending Work"}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
