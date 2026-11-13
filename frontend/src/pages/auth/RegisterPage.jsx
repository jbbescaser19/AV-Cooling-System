import {
  sanitizePersonName,
  sanitizeContactNumber,
} from "../../utils/fieldSanitizers.js";
import { syncGuestCart } from "../../utils/cartStore";
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
import {
  continuePendingAction,
  getPendingAction,
} from "../../utils/purchaseFlow";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("details");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");

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

    const cleaned =
      name === "phone"
        ? sanitizeContactNumber(value)
        : name === "fullName"
          ? sanitizePersonName(value)
          : value;
    setFormData((previous) => ({
      ...previous,
      [name]: cleaned,
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

      if (response.data?.verificationRequired) {
        setStage("verify");
        setNotice(
          response.data?.message ||
            "Check your email for the verification code.",
        );
        setError("");
      } else {
        setError("Verification could not be started. Please try again.");
      }
    } catch (requestError) {
      console.error(
        "Registration error:",
        requestError.response?.data?.message || requestError.message,
      );

      setError(
        requestError.response?.data?.message ||
          "Could not send the verification email. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the six digits from your verification email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/auth/customer/register/verify", {
        email: formData.email.trim().toLowerCase(),
        otp,
      });
      if (!data?.success) throw new Error("The code could not be verified.");
      try {
        await syncGuestCart();
        if (getPendingAction()) continuePendingAction(navigate);
        else navigate("/account/profile", { replace: true });
      } catch (syncError) {
        navigate("/cart", {
          replace: true,
          state: {
            cartWarning:
              syncError.response?.data?.message ||
              "Your account is verified, but some cart items may be unavailable. Please check your cart.",
          },
        });
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Invalid code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/auth/customer/register", {
        ...formData,
        acceptTerms,
      });
      setNotice(data?.message || "A new verification code has been sent.");
      setOtp("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to resend code. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (stage === "verify") {
    return (
      <div className="auth-shell auth-register-page">
        <form
          className="auth-card auth-register-card otp-verification-card"
          onSubmit={verifyCode}
        >
          <div className="auth-register-heading">
            <Mail size={26} aria-hidden="true" />
            <div>
              <div className="eyebrow">Verify your email</div>
              <h1>Check your inbox</h1>
            </div>
          </div>
          <p className="muted">
            Enter the six-digit code sent to{" "}
            <strong>{formData.email.trim()}</strong>. The code expires in 10
            minutes.
          </p>
          {notice && (
            <p className="otp-notice" role="status">
              {notice}
            </p>
          )}
          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-otp">
              Verification code
            </label>
            <input
              id="register-otp"
              className="form-control otp-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              required
              disabled={loading}
              autoFocus
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
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying..." : "Verify email and create account"}
          </button>
          <div className="otp-verification-actions">
            <button type="button" onClick={resendCode} disabled={loading}>
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("details");
                setOtp("");
                setError("");
              }}
              disabled={loading}
            >
              Edit details
            </button>
          </div>
          <p className="auth-register-footer">
            Already verified? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    );
  }

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
              maxLength={150}
              autoComplete="name"
              value={formData.fullName}
              onChange={handleFormData}
              required
              disabled={loading}
            />
          </div>
          <small className="auth-field-hint">
            Letters only. Spaces, hyphens and apostrophes are allowed.
          </small>
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
              placeholder="09XXXXXXXXX"
              inputMode="tel"
              maxLength={17}
              title="Enter a Philippine mobile number starting with 09 or +639"
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
          {loading ? "Sending code..." : "Send verification code"}
        </button>

        <p className="auth-register-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
