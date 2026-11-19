import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { LockKeyhole, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";

import PasswordStrength from "../../components/auth/PasswordStrength.jsx";

import { isStrongPassword } from "../../utils/passwordPolicy.js";

import { logoutCustomer } from "../../utils/authMock";

import {
  clearPendingAction,
  clearDirectCheckout,
} from "../../utils/purchaseFlow";

import "../../styles/customer/change-password.css";

const emptyForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  signOutAllDevices: false,
};

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordIsStrong = isStrongPassword(form.newPassword);

  const passwordsMatch = form.newPassword === form.confirmPassword;

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (error) setError("");
    if (success) setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    if (!passwordIsStrong) {
      setError("Your password must meet all requirements.");

      return;
    }

    if (!passwordsMatch) {
      setError("The new passwords do not match.");

      return;
    }

    if (form.currentPassword === form.newPassword) {
      setError("Choose a password different from your current password.");

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.patch("/api/customer/account/password", form);

      if (!data?.success) {
        throw new Error("The password update was not confirmed.");
      }

      setForm(emptyForm);

      if (data.signOutAllDevices) {
        logoutCustomer();

        clearPendingAction();
        clearDirectCheckout();

        navigate("/login", {
          replace: true,
          state: {
            message: data.message,
          },
        });

        return;
      }

      setSuccess(data.message || "Password updated. You are still signed in.");
    } catch (requestError) {
      setForm((previous) => ({
        ...previous,
        currentPassword: "",
      }));

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update your password. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="customer-module customer-password-page">
      <CustomerPageHeader
        Icon={LockKeyhole}
        title="Change Password"
        copy="Secure your account with a new password."
      />

      <form className="surface customer-password-card" onSubmit={submit}>
        <div className="customer-password-intro">
          <ShieldCheck size={20} aria-hidden="true" />

          <div>
            <strong>Keep your account secure</strong>

            <p>
              Enter your current password and create a new password that meets
              all requirements.
            </p>
          </div>
        </div>

        {error && (
          <p className="customer-password-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="customer-password-success" role="status">
            {success}
          </p>
        )}

        <div className="customer-password-grid">
          <div className="customer-password-fields">
            <label htmlFor="customer-current-password">
              Current password
              <input
                id="customer-current-password"
                className="form-control"
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={form.currentPassword}
                onChange={(event) =>
                  update("currentPassword", event.target.value)
                }
                maxLength={128}
                required
                disabled={saving}
              />
            </label>

            <label htmlFor="customer-new-password">
              New password
              <input
                id="customer-new-password"
                className="form-control"
                type="password"
                autoComplete="new-password"
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={(event) => update("newPassword", event.target.value)}
                minLength={12}
                maxLength={72}
                required
                disabled={saving}
              />
            </label>

            <label htmlFor="customer-confirm-password">
              Confirm new password
              <input
                id="customer-confirm-password"
                className="form-control"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={form.confirmPassword}
                onChange={(event) =>
                  update("confirmPassword", event.target.value)
                }
                minLength={12}
                maxLength={72}
                required
                disabled={saving}
              />
            </label>
          </div>

          <div className="customer-password-strength-panel">
            <PasswordStrength value={form.newPassword} />
          </div>
        </div>

        <label className="customer-password-signout">
          <input
            type="checkbox"
            checked={form.signOutAllDevices}
            onChange={(event) =>
              update("signOutAllDevices", event.target.checked)
            }
            disabled={saving}
          />

          <span>
            <strong>Sign out on all devices after updating</strong>

            <small>
              If checked, you will need to sign in again everywhere, including
              here. If unchecked, existing sessions will stay signed in.
            </small>
          </span>
        </label>

        <button
          type="submit"
          className="btn btn-dark customer-password-submit"
          disabled={
            saving ||
            !form.currentPassword ||
            !passwordIsStrong ||
            !passwordsMatch
          }
        >
          {saving ? "Updating password…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
