import { useEffect, useState } from "react";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";

import { Menu, Bell, UserRound, LogOut } from "lucide-react";

import Sidebar from "../components/management/Sidebar";

import { notifications as seedNotifications } from "../data/mockManagement";

import { getStaff, logoutStaff } from "../utils/authMock";

import { getStoredNotifications } from "../utils/managementStore";

import "../styles/management/management.css";

/* =========================================================
   ROLE ACCESS
========================================================= */

const access = {
  OWNER: [
    "dashboard",
    "pos",
    "orders",
    "payments",
    "products",
    "inventory",
    "stock-movements",
    "service-types",
    "service-requests",
    "work-orders",
    "technicians",
    "schedules",
    "customers",
    "website-content",
    "feedback",
    "contact-messages",
    "facebook-requests",
    "reports",
    "notifications",
    "audit-logs",

    // OWNER ONLY
    "staff",
  ],

  MANAGER: [
    "dashboard",
    "pos",
    "orders",
    "payments",
    "products",
    "inventory",
    "stock-movements",
    "service-types",
    "service-requests",
    "work-orders",
    "technicians",
    "schedules",
    "customers",
    "website-content",
    "feedback",
    "contact-messages",
    "facebook-requests",
    "reports",
    "notifications",
  ],

  SALES_CASHIER: [
    "dashboard",
    "pos",
    "orders",
    "payments",
    "products",
    "customers",
    "contact-messages",
    "facebook-requests",
    "notifications",
  ],

  TECHNICIAN: [
    "dashboard",
    "service-requests",
    "work-orders",
    "schedules",
    "notifications",
  ],
};

export default function ManagementLayout() {
  const [open, setOpen] = useState(false);

  const [unread, setUnread] = useState(() => {
    return getStoredNotifications(seedNotifications).filter(
      (item) => !item.read,
    ).length;
  });

  const staff = getStaff();
  const location = useLocation();

  /* =========================================================
     NOTIFICATION COUNT
  ========================================================= */

  useEffect(() => {
    const refresh = () => {
      const notifications = getStoredNotifications(seedNotifications);

      const unreadCount = notifications.filter((item) => !item.read).length;

      setUnread(unreadCount);
    };

    window.addEventListener("av-management-updated", refresh);

    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("av-management-updated", refresh);

      window.removeEventListener("storage", refresh);
    };
  }, []);

  /* =========================================================
     NOT LOGGED IN
  ========================================================= */

  if (!staff) {
    return <Navigate to="/management/login" replace />;
  }

  /* =========================================================
     ROLE ACCESS CHECK
  ========================================================= */

  const slug = location.pathname.split("/")[2] || "dashboard";

  const allowedPages = access[staff.role] || [];

  if (!allowedPages.includes(slug)) {
    return <Navigate to="/management" replace />;
  }

  /* =========================================================
     LAYOUT
  ========================================================= */

  return (
    <div className="mgmt-shell">
      {/* SIDEBAR */}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* MOBILE SIDEBAR BACKDROP */}

      {open && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      {/* MAIN WORKSPACE */}

      <div className="mgmt-workspace">
        {/* TOP BAR */}

        <header className="mgmt-topbar">
          {/* MOBILE MENU */}

          <button
            className="mgmt-menu"
            type="button"
            aria-label="Open management navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={19} />
          </button>

          {/* TITLE */}

          <div>
            <b>AV Cooling Management</b>

            <span>Sales, inventory, service, and operations</span>
          </div>

          {/* RIGHT SIDE */}

          <div className="mgmt-top-actions">
            {/* NOTIFICATIONS */}

            <Link
              className="mgmt-notification-link"
              to="/management/notifications"
              title="Notifications"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={18} />

              {unread > 0 && (
                <span className="mgmt-notification-count">{unread}</span>
              )}
            </Link>

            {/* CURRENT STAFF */}

            <span className="staff-chip">
              <UserRound size={16} />

              {staff.role.replaceAll("_", " ")}
            </span>

            {/* LOGOUT */}

            <Link
              title="Log out"
              aria-label="Log out"
              to="/management/login"
              onClick={logoutStaff}
            >
              <LogOut size={18} />
            </Link>
          </div>
        </header>

        {/* CURRENT PAGE */}

        <main className="mgmt-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
