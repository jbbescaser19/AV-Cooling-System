import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { KeyRound, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";

import { logoutStaff } from "../../utils/authMock.js";

import "../../styles/management/staff-password.css";

const initial = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ManagementChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    if (form.newPassword.length < 8) {
      setError("Use at least eight characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data } = await api.post(
        "/api/management/auth/change-password",
        form,
      );

      if (!data.success) {
        throw new Error("Password update was not confirmed.");
      }

      logoutStaff();
      setForm(initial);

      navigate("/management/login", {
        replace: true,
        state: {
          message: data.message,
        },
      });
    } catch (error) {
      setForm((previous) => ({
        ...previous,
        currentPassword: "",
      }));

      setError(
        error.response?.data?.message ||
          error.message ||
          "Cannot update password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-password-page">
      <header className="staff-password-header">
        <KeyRound size={22} aria-hidden="true" />

        <div>
          <h1>Change Password</h1>

          <p>For Owner, Manager, Cashier, and Technician accounts.</p>
        </div>
      </header>

      <form className="staff-password-card" onSubmit={submit}>
        <p className="staff-password-info">
          <ShieldCheck size={18} aria-hidden="true" />
          Use your current password, or the temporary password given privately
          by the Owner. All previous login sessions end after the change.
        </p>

        {error && (
          <p className="staff-password-error" role="alert">
            {error}
          </p>
        )}

        <label>
          Current or temporary password
          <input
            required
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={form.currentPassword}
            disabled={busy}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                currentPassword: event.target.value,
              }))
            }
          />
        </label>

        <label>
          New password
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={form.newPassword}
            disabled={busy}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                newPassword: event.target.value,
              }))
            }
          />
        </label>

        <label>
          Confirm new password
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={form.confirmPassword}
            disabled={busy}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                confirmPassword: event.target.value,
              }))
            }
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? "Updating…" : "Change password and sign out devices"}
        </button>
      </form>
    </section>
  );
}
