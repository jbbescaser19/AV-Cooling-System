import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/management-session.css";

export default function ManagementReauthGate({
  session,
  onVerified,
  children,
}) {
  const [verifiedUntil, setVerifiedUntil] = useState(
    session.reauthenticatedUntil || 0,
  );
  const [now, setNow] = useState(Date.now());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVerifiedUntil(session.reauthenticatedUntil || 0);
  }, [session.reauthenticatedUntil]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function confirmPassword(event) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/management/auth/reauthenticate", {
        password,
      });
      if (!data.success || !data.session?.reauthenticatedUntil) {
        throw new Error("Password confirmation failed.");
      }
      setVerifiedUntil(data.session.reauthenticatedUntil);
      onVerified(data.session);
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to confirm password.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  if (verifiedUntil > now) return children;

  return (
    <section className="mgmt-reauth-card" aria-labelledby="mgmt-reauth-title">
      <div className="mgmt-reauth-icon">
        <LockKeyhole size={25} />
      </div>
      <h1 id="mgmt-reauth-title">Confirm your password</h1>
      <p>
        Staff account changes are sensitive. Enter your Management password
        again to access the staff tools for 10 minutes.
      </p>
      <form onSubmit={confirmPassword}>
        <label htmlFor="mgmt-reauth-password">
          Current Management password
        </label>
        <input
          id="mgmt-reauth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={busy}
        />
        {error && (
          <p className="mgmt-reauth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !password}>
          <ShieldCheck size={18} />{" "}
          {busy ? "Checking…" : "Confirm and continue"}
        </button>
      </form>
    </section>
  );
}
