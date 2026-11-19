import { useRef, useState } from "react";

import { Link, useNavigate, useLocation } from "react-router-dom";

import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  Snowflake,
  ArrowLeft,
} from "lucide-react";

import api from "../../../api/api.js";

import { syncGuestCart } from "../../utils/cartStore.js";

import {
  PENDING_ACTIONS,
  continuePendingAction,
  getPendingAction,
  clearPendingAction,
  clearDirectCheckout,
} from "../../utils/purchaseFlow.js";

import { showActionNotice } from "../../utils/confirmAction.jsx";

import "../../styles/auth/auth.css";
import "../../styles/auth/login.css";

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

  const submittingRef = useRef(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  function handleBackToHome() {
    if (submittingRef.current) return;

    clearPendingAction();
    clearDirectCheckout();

    navigate("/", {
      replace: true,
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    submittingRef.current = true;

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

      const from = location.state?.from || null;

      const pending = getPendingAction();

      let cartWarning = "";

      try {
        await syncGuestCart();
      } catch (syncError) {
        cartWarning =
          syncError.response?.data?.message ||
          "Some previous cart items could not be synced. Please review your cart.";
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
          state: {
            cartWarning,
          },
        });

        return;
      }

      const notice = await continuePendingAction(navigate, from);

      if (notice || cartWarning) {
        void showActionNotice({
          title: cartWarning ? "Cart Notice" : notice.title,

          message: [notice?.message, cartWarning].filter(Boolean).join(" "),
        });
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed. Please check your credentials and try again.",
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-login-page">
      <form className="auth-card auth-register-card" onSubmit={handleSubmit}>
        <button
          type="button"
          className="btn btn-soft"
          onClick={handleBackToHome}
          disabled={loading}
          style={{
            justifySelf: "start",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 12px",
            fontSize: "0.8rem",
            minHeight: "34px",
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Home
        </button>

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
              disabled={loading}
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
              disabled={loading}
              required
            />

            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={loading}
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
          Don't have an account?{" "}
          <Link to="/register" state={location.state}>
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
