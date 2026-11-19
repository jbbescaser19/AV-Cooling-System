import { useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import { KeyRound, Mail, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";

import "../../styles/auth/auth.css";
import "../../styles/auth/password-recovery.css";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState("request");

  const [email, setEmail] = useState("");

  const [code, setCode] = useState("");

  const [password, setPassword] = useState("");

  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  async function request(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.post(
        "/api/auth/customer/password-reset/request",
        {
          email: email.trim().toLowerCase(),
        },
      );

      if (!data.success) {
        throw new Error("Reset request was not confirmed.");
      }

      setNotice(data.message);
      setStep("verify");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Could not send a code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reset(event) {
    event.preventDefault();

    if (busy) return;

    if (password.length < 8) {
      setError("New password must have at least eight characters.");
      return;
    }

    if (password !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data } = await api.post(
        "/api/auth/customer/password-reset/confirm",
        {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword: password,
          confirmPassword: confirm,
        },
      );

      if (!data.success) {
        throw new Error("Password change was not confirmed.");
      }

      setCode("");
      setPassword("");
      setConfirm("");

      navigate("/login", {
        replace: true,
        state: {
          message: data.message,
        },
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Could not reset password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell av-forgot-password">
      <form
        className="auth-card"
        onSubmit={step === "request" ? request : reset}
      >
        <div className="eyebrow">
          <KeyRound size={16} />
          Account recovery
        </div>

        <h1>Forgot your password?</h1>

        <p className="muted">
          {step === "request"
            ? "Enter your customer account email. We'll send a six-digit verification code."
            : "Enter the six-digit code sent to your email and choose a new password."}
        </p>

        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="auth-success">
            {notice}
          </p>
        )}

        <label htmlFor="recovery-email">
          <Mail size={15} aria-hidden="true" />
          Email address
        </label>

        <input
          id="recovery-email"
          className="form-control"
          type="email"
          autoComplete="email"
          maxLength={255}
          value={email}
          required
          disabled={busy || step === "verify"}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />

        {step === "verify" && (
          <>
            <label htmlFor="recovery-code">
              Verification code (expires in 10 minutes)
            </label>

            <input
              id="recovery-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="form-control"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              disabled={busy}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6-digit code"
            />

            <label htmlFor="recovery-password">New password</label>

            <input
              id="recovery-password"
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label htmlFor="recovery-confirm">Confirm new password</label>

            <input
              id="recovery-confirm"
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              disabled={busy}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />

            <p className="av-recovery-hint">
              <ShieldCheck size={15} />
              Your previous sessions will end after reset.
            </p>
          </>
        )}

        <button className="btn btn-dark" type="submit" disabled={busy}>
          {busy
            ? "Processing…"
            : step === "request"
              ? "Send verification code"
              : "Reset password"}
        </button>

        {step === "verify" && (
          <div className="av-recovery-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("request");
                setCode("");
                setNotice("");
                setError("");
              }}
            >
              Request another code
            </button>
          </div>
        )}

        <p className="av-recovery-back">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </main>
  );
}
