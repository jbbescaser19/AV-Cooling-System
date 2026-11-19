import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

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
import PasswordStrength from "../../components/auth/PasswordStrength.jsx";

import {
  sanitizePersonName,
  sanitizeContactNumber,
} from "../../utils/fieldSanitizers.js";

import { isStrongPassword } from "../../utils/passwordPolicy.js";
import { syncGuestCart } from "../../utils/cartStore";

import {
  PENDING_ACTIONS,
  getPendingAction,
  continuePendingAction,
  clearPendingAction,
  clearDirectCheckout,
} from "../../utils/purchaseFlow";

import { showActionNotice } from "../../utils/confirmAction.jsx";

import "../../styles/auth/auth.css";
import "../../styles/auth/register.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const submittingRef = useRef(false);

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

  const passwordIsStrong = isStrongPassword(formData.password);

  useEffect(() => {
    if (!error) return;

    const timeoutId = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [error]);

  const handleFormData = (event) => {
    const { name, value } = event.target;

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

  const registerCustomer = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    setError("");

    if (!passwordIsStrong) {
      setError("Your password must meet all requirements.");
      return;
    }

    if (!acceptTerms) {
      setError(
        "Please accept the Terms and Conditions before creating an account.",
      );
      return;
    }

    submittingRef.current = true;
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
      setError(
        requestError.response?.data?.message ||
          "Could not send the verification email. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the six digits from your verification email.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post(
        "/api/auth/customer/register/verify",
        {
          email: formData.email.trim().toLowerCase(),
          otp,
        },
        {
          withCredentials: true,
        },
      );

      if (!data?.success) {
        throw new Error("The code could not be verified.");
      }

      // Preserve the customer's original action.
      const pending = getPendingAction();
      const from = location.state?.from || null;

      let cartWarning = "";

      try {
        await syncGuestCart();
      } catch (syncError) {
        cartWarning =
          syncError.response?.data?.message ||
          "Your account is verified, but some cart items could not be synced. Please review your cart.";
      }

      const checkoutRequested =
        from?.pathname === "/checkout" ||
        from === "/checkout" ||
        (!from &&
          [
            PENDING_ACTIONS.ORDER_NOW,
            PENDING_ACTIONS.CHECKOUT_CART,
            "checkout",
          ].includes(pending?.type));

      if (cartWarning && checkoutRequested) {
        clearPendingAction();
        clearDirectCheckout();

        navigate("/cart", {
          replace: true,
          state: { cartWarning },
        });

        return;
      }

      // Resume the action using the same flow as login.
      if (pending || from) {
        const actionNotice = await continuePendingAction(navigate, from);

        if (actionNotice || cartWarning) {
          void showActionNotice({
            title: cartWarning ? "Cart Notice" : actionNotice.title,

            message: [actionNotice?.message, cartWarning]
              .filter(Boolean)
              .join(" "),
          });
        }

        return;
      }

      // Normal registration without a pending action.
      clearPendingAction();
      clearDirectCheckout();

      if (cartWarning) {
        navigate("/cart", {
          replace: true,
          state: { cartWarning },
        });

        return;
      }

      navigate("/account/profile", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Invalid code. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
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
      submittingRef.current = false;
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
            Already verified?{" "}
            <Link to="/login" state={location.state}>
              Log in
            </Link>
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
              placeholder="At least 12 characters"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
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

          <PasswordStrength value={formData.password} />
        </div>

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
          disabled={loading || !acceptTerms || !passwordIsStrong}
        >
          {loading ? "Sending code..." : "Send verification code"}
        </button>

        <p className="auth-register-footer">
          Already have an account?{" "}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
