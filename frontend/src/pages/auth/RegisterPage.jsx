import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound,
  Mail,
  Phone,
  LockKeyhole,
  Eye,
  EyeOff,
  Snowflake,
} from "lucide-react";

import api from "../../../api/api";
import "../../styles/auth/auth.css";
import { continuePendingAction } from "../../utils/purchaseFlow";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  useEffect(() => {
    if (!error) return;

    const timeoutId = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [error]);

  const handleFormData = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const registerCustomer = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);

    try {
      const response = await api.post("/api/auth/customer/register", formData);

      if (response.data.success) {
        continuePendingAction(navigate);
      } else {
        setError("Signup failed");
        return;
      }
    } catch (error) {
      console.error(
        "Registration error:",
        error.response?.data || error.message,
      );

      setError(
        error.response?.data?.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form
        className="auth-card auth-register-card"
        onSubmit={registerCustomer}
      >
        <div className="auth-register-heading">
          <Snowflake size={25} aria-hidden="true" />

          <div>
            <div className="eyebrow">AV Cooling System</div>
            <h1>Create account</h1>
          </div>
        </div>

        <p className="muted">
          Register to shop products and request air-conditioning services.
        </p>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="register-name">
            Full name
          </label>

          <div className="auth-input-wrap">
            <UserRound
              className="auth-input-icon"
              size={18}
              aria-hidden="true"
            />

            <input
              id="register-name"
              className="form-control"
              name="fullName"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              value={formData.fullName}
              onChange={handleFormData}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="register-email">
            Email address
          </label>

          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" size={18} aria-hidden="true" />

            <input
              id="register-email"
              className="form-control"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={formData.email}
              onChange={handleFormData}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="register-phone">
            Phone number
          </label>

          <div className="auth-input-wrap">
            <Phone className="auth-input-icon" size={18} aria-hidden="true" />

            <input
              id="register-phone"
              className="form-control"
              name="phone"
              type="tel"
              placeholder="Enter your phone number"
              autoComplete="tel"
              value={formData.phone}
              onChange={handleFormData}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="register-password">
            Password
          </label>

          <div className="auth-input-wrap">
            <LockKeyhole
              className="auth-input-icon"
              size={18}
              aria-hidden="true"
            />

            <input
              id="register-password"
              className="form-control"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              value={formData.password}
              onChange={handleFormData}
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

        <div className="auth-field">
          <label
            className="auth-field-label"
            htmlFor="register-confirm-password"
          >
            Confirm password
          </label>

          <div className="auth-input-wrap">
            <LockKeyhole
              className="auth-input-icon"
              size={18}
              aria-hidden="true"
            />

            <input
              id="register-confirm-password"
              className="form-control"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleFormData}
              required
            />

            <button
              className="auth-password-toggle"
              type="button"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              onClick={() => setShowConfirmPassword((previous) => !previous)}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="btn btn-dark auth-register-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="auth-register-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
