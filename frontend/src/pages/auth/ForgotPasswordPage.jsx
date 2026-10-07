import { useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/auth/auth.css";
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="auth-shell">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <div className="eyebrow">Account Recovery</div>
        <h1>Forgot password</h1>
        <p className="muted">
          Enter your email to simulate a password-reset request.
        </p>
        <input
          className="form-control"
          type="email"
          placeholder="Email"
          required
        />
        <button className="btn btn-dark">Send Reset Link</button>
        {sent && (
          <div className="auth-success">
            Mock reset link sent. No real email is sent in this frontend
            prototype.
          </div>
        )}
        <p>
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </div>
  );
}
