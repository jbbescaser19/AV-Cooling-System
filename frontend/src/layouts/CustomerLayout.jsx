import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";

import {
  User,
  Package,
  CalendarDays,
  CreditCard,
  Bell,
  MessageSquare,
  MapPin,
  Lock,
  Home,
  LogOut,
} from "lucide-react";

import api from "../../api/api.js";

import { logoutCustomer } from "../utils/authMock";

import { clearPendingAction, clearDirectCheckout } from "../utils/purchaseFlow";

import "../styles/customer/customer.css";

const items = [
  ["profile", User, "Profile"],
  ["orders", Package, "Orders"],
  ["services", CalendarDays, "Services"],
  ["payments", CreditCard, "Payments"],
  ["notifications", Bell, "Notifications"],
  ["feedback", MessageSquare, "Feedback"],
  ["addresses", MapPin, "Addresses"],
  ["change-password", Lock, "Password"],
];

export default function CustomerLayout() {
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setLogoutError("");

    try {
      await api.post(
        "/api/auth/customer/logout",
        {},
        { withCredentials: true },
      );

      // Clear the old mock login state.
      logoutCustomer();

      // Prevent an old checkout or service action from resuming later.
      clearPendingAction();
      clearDirectCheckout();

      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(
        error.response?.data?.message ||
          "Unable to log out. Please check your connection and try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="customer-shell">
      <aside className="customer-side">
        <Link to="/" className="customer-home">
          <Home size={18} />
          <span>AV Cooling</span>
        </Link>

        <h2>My Account</h2>

        <nav aria-label="Customer account navigation">
          {items.map(([path, Icon, label]) => (
            <NavLink key={path} to={path}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {logoutError && (
          <p role="alert" className="customer-logout-error">
            {logoutError}
          </p>
        )}

        <button
          type="button"
          className="customer-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} />
          <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
        </button>
      </aside>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
