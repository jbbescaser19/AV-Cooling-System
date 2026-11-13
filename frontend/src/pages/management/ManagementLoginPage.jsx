import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { Building2, LogIn, ShieldCheck } from "lucide-react";

import api from "../../../api/api.js";
import { loginStaff } from "../../utils/authMock";

import "../../styles/auth/auth.css";

export default function ManagementLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const { data } = await api.post("/api/management/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (!data.success || !data.staff?.role) {
        throw new Error("Staff sign-in was not confirmed.");
      }

      loginStaff(data.staff);
      setPassword("");

      navigate(
        data.staff.mustChangePassword
          ? "/management/change-password"
          : data.staff.role === "SALES_CASHIER"
            ? "/management/pos"
            : "/management/dashboard",
        {
          replace: true,
        },
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to sign in. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell mgmt-login">
      <form className="auth-card" onSubmit={signIn}>
        <div className="eyebrow">
          <ShieldCheck size={17} />
          Secure management access
        </div>

        <h1>
          <Building2 size={27} aria-hidden="true" />
          AV Cooling Staff
        </h1>

        <p className="muted">
          Sign in using the email and password assigned to your staff account.
          Your role is checked by the server. If you forgot your password, ask
          the Owner to reset it. You will then choose a new password.
        </p>

        {location.state?.message && (
          <p className="auth-success" role="status">
            {location.state.message}
          </p>
        )}

        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}

        <div className="form-group">
          <label htmlFor="staff-email">Email address</label>

          <input
            id="staff-email"
            type="email"
            className="form-control"
            autoComplete="username"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="staff-password">Password</label>

          <input
            id="staff-password"
            type="password"
            className="form-control"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>

        <button className="btn btn-primary" disabled={busy} type="submit">
          <LogIn size={17} />

          {busy ? "Signing in…" : "Sign in to Management"}
        </button>
      </form>
    </main>
  );
}
