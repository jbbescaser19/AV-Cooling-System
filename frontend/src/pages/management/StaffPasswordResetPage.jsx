import { useEffect, useState } from "react";

import { Copy, KeyRound, ShieldCheck, X } from "lucide-react";

import api from "../../../api/api.js";

import "../../styles/management/staff-password.css";

export default function StaffPasswordResetPage() {
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState("");

  const [ownerPassword, setOwnerPassword] = useState("");

  const [confirming, setConfirming] = useState(false);

  const [temporary, setTemporary] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/management/auth/staff-password-reset", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setStaff(data.items || []);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error.response?.data?.message || "Could not load staff accounts.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  async function reset() {
    if (busy || !staffId || !ownerPassword) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setTemporary("");

    try {
      const { data } = await api.post(
        "/api/management/auth/staff-password-reset",
        {
          staffId: Number(staffId),
          ownerPassword,
        },
      );

      if (!data.success || !data.temporaryPassword) {
        throw new Error("The password reset was not confirmed.");
      }

      setTemporary(data.temporaryPassword);

      setNotice(data.message);
      setOwnerPassword("");
      setConfirming(false);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Password reset failed.",
      );

      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const selectedStaff = staff.find((person) => String(person.id) === staffId);

  return (
    <section className="staff-password-page">
      <header className="staff-password-header">
        <KeyRound size={23} aria-hidden="true" />

        <div>
          <h1>Reset Staff Password</h1>

          <p>
            Owner only · Help staff regain access without viewing existing
            passwords.
          </p>
        </div>
      </header>

      <div className="staff-password-card">
        <p className="staff-password-info">
          <ShieldCheck size={18} aria-hidden="true" />
          Existing passwords cannot be viewed because they are securely hashed.
          A temporary password is shown only once, and staff must change it
          after signing in.
        </p>

        {error && (
          <p className="staff-password-error" role="alert">
            {error}
          </p>
        )}

        <label htmlFor="reset-staff-selector">
          Staff account
          <select
            id="reset-staff-selector"
            value={staffId}
            disabled={busy}
            onChange={(event) => {
              setStaffId(event.target.value);
              setTemporary("");
              setError("");
            }}
          >
            <option value="">Choose a staff member</option>

            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.role.replaceAll("_", " ")} ·{" "}
                {person.email}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="owner-reset-password">
          Confirm your Owner password
          <input
            id="owner-reset-password"
            type="password"
            autoComplete="current-password"
            value={ownerPassword}
            maxLength={128}
            disabled={busy}
            onChange={(event) => setOwnerPassword(event.target.value)}
          />
        </label>

        <button
          type="button"
          disabled={!staffId || !ownerPassword || busy}
          onClick={() => setConfirming(true)}
        >
          Generate temporary password
        </button>

        {temporary && (
          <section className="staff-password-result" role="status">
            <strong>Temporary password — visible only this time</strong>

            <code>{temporary}</code>

            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(temporary)}
            >
              <Copy size={15} />
              Copy password
            </button>

            <p>{notice}</p>

            <p>
              Share it privately with the correct staff member. Do not keep it
              in a shared document.
            </p>
          </section>
        )}
      </div>

      {confirming && (
        <div
          className="staff-reset-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setConfirming(false);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="staff-reset-title"
            aria-describedby="staff-reset-description"
            className="staff-reset-dialog"
          >
            <button
              type="button"
              className="staff-reset-close"
              disabled={busy}
              aria-label="Close confirmation"
              onClick={() => setConfirming(false)}
            >
              <X size={19} />
            </button>

            <h2 id="staff-reset-title">Reset this staff password?</h2>

            <p id="staff-reset-description">
              <strong>{selectedStaff?.name}</strong> (
              {selectedStaff?.role.replaceAll("_", " ")}) will be signed out on
              all devices. Their old password will stop working. You will
              receive one temporary password to share privately.
            </p>

            <div className="staff-reset-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void reset()}
              >
                {busy ? "Resetting…" : "Confirm reset"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
