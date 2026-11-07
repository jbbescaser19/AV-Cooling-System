import { useEffect, useRef, useState } from "react";
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
  Menu,
  X,
} from "lucide-react";

import api from "../../api/api.js";
import { logoutCustomer } from "../utils/authMock";
import { clearPendingAction, clearDirectCheckout } from "../utils/purchaseFlow";

import "../styles/customer/customer.css";
import "../styles/customer/customer-snowflakes.css";
import "../styles/customer/customer-navigation.css";

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
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 760px)").matches
      : false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const handleChange = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMenuOpen(false);
    };

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile || !menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll(
          "a[href], button:not([disabled])",
        ) || [],
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    if (isMobile) menuButtonRef.current?.focus();
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await api.post(
        "/api/auth/customer/logout",
        {},
        { withCredentials: true },
      );

      logoutCustomer();
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
      <header className="customer-mobile-header">
        <Link to="/" className="customer-mobile-brand">
          AV Cooling
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className="customer-menu-toggle"
          aria-controls="customer-account-sidebar"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </header>

      {isMobile && menuOpen && (
        <button
          type="button"
          className="customer-menu-scrim"
          aria-label="Close account menu"
          onClick={closeMenu}
        />
      )}

      <aside
        id="customer-account-sidebar"
        ref={sidebarRef}
        className={`customer-side${menuOpen ? " is-open" : ""}`}
        role={isMobile && menuOpen ? "dialog" : undefined}
        aria-label="Customer account navigation"
        aria-modal={isMobile && menuOpen ? "true" : undefined}
        inert={isMobile && !menuOpen}
      >
        <div className="customer-side-header">
          <Link to="/" className="customer-home" onClick={closeMenu}>
            <Home size={18} aria-hidden="true" />
            <span>AV Cooling</span>
          </Link>

          <button
            ref={closeButtonRef}
            type="button"
            className="customer-side-close"
            onClick={closeMenu}
          >
            <X size={19} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <h2>My Account</h2>

        <nav aria-label="Customer account pages">
          {items.map(([path, Icon, label]) => (
            <NavLink key={path} to={path} onClick={closeMenu}>
              <Icon size={18} aria-hidden="true" />
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
          <LogOut size={18} aria-hidden="true" />
          <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
        </button>
      </aside>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
