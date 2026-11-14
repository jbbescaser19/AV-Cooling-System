import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/delete-customer-account.css";

export default function DeleteStaffAccountAction({
  staff,
  isOwner,
  onDeleted,
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const buttonRef = useRef(null);
  const dialogRef = useRef(null);
  const busyRef = useRef(false);

  busyRef.current = busy;

  const id = Number(staff?.id);

  useEffect(() => {
    if (!open) return undefined;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    const handleKey = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
        setOpen(false);
      }

      if (event.key !== "Tab") return;

      const elements = [
        ...(dialogRef.current?.querySelectorAll(
          "button:not(:disabled), input:not(:disabled)",
        ) || []),
      ];

      const first = elements[0];
      const last = elements.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKey);
      buttonRef.current?.focus();
    };
  }, [open]);

  if (
    !isOwner ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    staff.role === "OWNER"
  ) {
    return null;
  }

  async function openDialog() {
    setOpen(true);
    setPreview(null);
    setError("");
    setPassword("");
    setConfirmation("");
    setLoading(true);

    try {
      const { data } = await api.get(
        `/api/management/workspace/staff/${id}/deletion-preview`,
      );

      if (!data?.success) {
        throw new Error("Could not check active assignments.");
      }

      setPreview(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not load staff account.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (busy || !preview?.canDelete || confirmation !== "DELETE" || !password) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data } = await api.delete(
        `/api/management/workspace/staff/${id}`,
        {
          data: { confirmation, password },
        },
      );

      if (!data?.success) {
        throw new Error("Staff deletion was not confirmed.");
      }

      setOpen(false);

      onDeleted?.(data.message || "Staff account deleted.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not delete account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="av-customer-delete-trigger wsm-row-action"
        onClick={openDialog}
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete Account
      </button>

      {open &&
        createPortal(
          <div
            className="av-customer-delete-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) {
                setOpen(false);
              }
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="staff-delete-title"
              className="av-customer-delete-dialog"
              ref={dialogRef}
              tabIndex={-1}
            >
              <header className="av-customer-delete-header">
                <span className="av-customer-delete-symbol">
                  <ShieldAlert size={20} />
                </span>

                <div>
                  <small>OWNER ONLY · STAFF ACCOUNTS</small>
                  <h2 id="staff-delete-title">Delete staff account?</h2>
                </div>

                <button
                  type="button"
                  className="av-customer-delete-close"
                  aria-label="Close confirmation"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <form onSubmit={submit}>
                <div className="av-customer-delete-content">
                  <p>
                    <strong>{staff.name}</strong> will lose Management access
                    and all active sessions. Historical audit, payments, and
                    work records will remain. The closure will appear in{" "}
                    <strong>Management → Archive → Staff Accounts</strong> and
                    cannot be restored.
                  </p>

                  <p className="av-customer-delete-caution">
                    <AlertTriangle size={18} />
                    <span>
                      Existing customer orders and services will not be
                      cancelled when removing a staff account. Technician jobs
                      must be reassigned first.
                    </span>
                  </p>

                  {loading && <p role="status">Checking for assigned work…</p>}

                  {preview && !preview.canDelete && (
                    <div className="av-customer-delete-blockers" role="alert">
                      <strong>Cannot delete yet:</strong>
                      <ul>
                        {preview.blockers.map((blocker, index) => (
                          <li key={index}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preview?.canDelete && (
                    <>
                      <label className="av-customer-delete-label">
                        Type DELETE to confirm
                        <input
                          required
                          autoComplete="off"
                          value={confirmation}
                          disabled={busy}
                          placeholder="DELETE"
                          onChange={(event) =>
                            setConfirmation(event.target.value)
                          }
                        />
                      </label>

                      <label className="av-customer-delete-label">
                        Confirm your Owner password
                        <input
                          required
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          disabled={busy}
                          placeholder="Owner password"
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {error && (
                    <p className="av-customer-delete-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <footer className="av-customer-delete-actions">
                  <button
                    type="button"
                    className="av-customer-delete-keep"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                  >
                    Keep Account
                  </button>

                  <button
                    type="submit"
                    className="av-customer-delete-submit"
                    disabled={
                      busy ||
                      loading ||
                      !preview?.canDelete ||
                      confirmation !== "DELETE" ||
                      !password
                    }
                  >
                    <Trash2 size={16} />
                    {busy ? "Deleting…" : "Delete Staff Account"}
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
