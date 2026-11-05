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
import TermsCheckbox from "../../components/auth/TermsCheckbox.jsx";

import "../../styles/auth/auth.css";
import "../../styles/auth/register.css";
import { continuePendingAction } from "../../utils/purchaseFlow";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
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

    if (loading) return;

    setError("");

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!acceptTerms) {
      setError(
        "Please accept the Terms and Conditions before creating an account.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/api/auth/customer/register", {
        ...formData,
        acceptTerms,
      });

      if (response.data?.success) {
        continuePendingAction(navigate);
      } else {
        setError("Signup failed.");
      }
    } catch (requestError) {
      console.error(
        "Registration error:",
        requestError.response?.data?.message || requestError.message,
      );

      setError(
        requestError.response?.data?.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-register-page">
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />

            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={loading}
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="auth-field">
          <TermsCheckbox
            checked={acceptTerms}
            onChange={setAcceptTerms}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="btn btn-dark auth-register-submit"
          type="submit"
          disabled={loading || !acceptTerms}
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
