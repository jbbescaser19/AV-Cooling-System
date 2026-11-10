import { useEffect, useRef, useState } from "react";
import {
  Outlet,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
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
import "../styles/customer/customer-notifications.css";
import "../styles/customer/customer-navigation.css";

const items = [
  ["profile", User, "Profile"],
  ["orders", Package, "Orders"],
  ["services", CalendarDays, "Services"],
  ["payments", CreditCard, "Payments"],
  ["notifications", Bell, "Notifications"],
  ["feedback", MessageSquare, "Feedback"],
  ["addresses", MapPin, "Addresses"],
  ["change-password", Lock, "Change Password"],
];

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const panelRef = useRef(null);

  const currentPage =
    items.find(
      ([path]) =>
        location.pathname === `/account/${path}` ||
        location.pathname.startsWith(`/account/${path}/`),
    )?.[2] || "My Account";

  // Close the menu whenever the customer changes pages.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Keyboard accessibility and background scroll locking.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const controls = Array.from(
        panelRef.current.querySelectorAll("a[href], button:not([disabled])"),
      ).filter((element) => element.getClientRects().length > 0);

      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onResize() {
      if (window.innerWidth > 1024) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  // Keep existing unread notification behavior.
  useEffect(() => {
    let active = true;

    async function refreshUnread() {
      try {
        const response = await api.get(
          "/api/customer/notifications/unread-count",
        );

        if (active) {
          setUnreadCount(Number(response.data.unreadCount || 0));
        }
      } catch {
        // Notification failures must not prevent navigation.
      }
    }

    refreshUnread();

    const interval = window.setInterval(refreshUnread, 45000);

    window.addEventListener("av-notifications-changed", refreshUnread);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("av-notifications-changed", refreshUnread);
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  async function handleLogout() {
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

      setUnreadCount(0);
      setMenuOpen(false);

      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(
        error.response?.data?.message ||
          "Unable to log out. Please check your connection and try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="customer-shell customer-nav-shell">
      {/* MOBILE AND TABLET HEADER */}

      <header className="customer-mobile-topbar">
        <div className="customer-mobile-identity">
          <Link
            to="/"
            className="customer-mobile-brand"
            aria-label="AV Cooling homepage"
          >
            AV Cooling
          </Link>

          <span className="customer-mobile-current">
            My Account · {currentPage}
          </span>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="customer-nav-menu-button"
          aria-label={menuOpen ? "Account menu open" : "Open account menu"}
          aria-expanded={menuOpen}
          aria-controls="customer-account-menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={21} aria-hidden="true" />
          <span>Menu</span>

          {unreadCount > 0 && (
            <span
              className="customer-menu-unread"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* DARK OVERLAY BEHIND THE OPEN MENU */}

      {menuOpen && (
        <button
          type="button"
          className="customer-nav-backdrop"
          aria-label="Close account menu"
          onClick={closeMenu}
        />
      )}

      {/* ACCOUNT NAVIGATION
          Desktop: visible sidebar.
          Mobile/tablet: slide-out menu.
      */}

      <aside
        id="customer-account-menu"
        ref={panelRef}
        className={`customer-side customer-nav-panel${
          menuOpen ? " is-open" : ""
        }`}
        aria-label="My Account menu"
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? true : undefined}
      >
        {/* DESKTOP BRAND */}

        <Link to="/" className="customer-home">
          <Home size={18} aria-hidden="true" />
          <span>AV Cooling</span>
        </Link>

        {/* MOBILE MENU HEADER */}

        <div className="customer-drawer-heading">
          <div>
            <strong>My Account</strong>
            <span>Choose a page below</span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="customer-drawer-close"
            onClick={closeMenu}
          >
            <X size={19} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        <h2>My Account</h2>

        {/* NAVIGATION LINKS */}

        <nav aria-label="Customer account navigation">
          {items.map(([path, Icon, label]) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              end={path === "profile"}
            >
              <Icon size={19} aria-hidden="true" />

              <span>{label}</span>

              {path === "notifications" && unreadCount > 0 && (
                <strong
                  className="customer-notification-navbadge"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </strong>
              )}
            </NavLink>
          ))}
        </nav>

        {/* LOGOUT ERROR */}

        {logoutError && (
          <p role="alert" className="customer-logout-error">
            {logoutError}
          </p>
        )}

        {/* LOG OUT */}

        <button
          type="button"
          className="customer-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut size={19} aria-hidden="true" />

          <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
        </button>
      </aside>

      {/* EXISTING ACCOUNT PAGE CONTENT */}

      <main className="customer-main" id="customer-account-content">
        <Outlet />
      </main>
    </div>
  );
}
