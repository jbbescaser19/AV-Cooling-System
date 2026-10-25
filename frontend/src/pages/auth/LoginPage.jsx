import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, LockKeyhole, Eye, EyeOff, Snowflake } from "lucide-react";

import api from "../../../api/api.js";
import { continuePendingAction } from "../../utils/purchaseFlow";

import "../../styles/auth/auth.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/customer/login", formData, {
        withCredentials: true,
      });

      if (!response.data?.success) {
        setError(response.data?.message || "Login failed.");
        return;
      }

      // Continue the pending action, or go to /shop if none exists.
      continuePendingAction(navigate);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed. Please check your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card auth-register-card" onSubmit={handleSubmit}>
        <div className="auth-register-heading">
          <Snowflake size={25} aria-hidden="true" />

          <div>
            <div className="eyebrow">AV Cooling System</div>
            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="muted">
          Log in to manage your orders and service requests.
        </p>

        {location.state?.message && (
          <div className="auth-success" role="status">
            {location.state.message}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="login-email">
            Email address
          </label>

          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" size={18} aria-hidden="true" />

            <input
              id="login-email"
              className="form-control"
              type="email"
              name="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="login-password">
            Password
          </label>

          <div className="auth-input-wrap">
            <LockKeyhole
              className="auth-input-icon"
              size={18}
              aria-hidden="true"
            />

            <input
              id="login-password"
              className="form-control"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button
          className="btn btn-dark auth-register-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="auth-register-footer">
          Don't have an account? <Link to="/register">Create account</Link>
        </p>
      </form>
    </div>
  );
}
