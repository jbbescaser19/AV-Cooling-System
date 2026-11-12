import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Bell, LogOut, Menu, UserRound } from "lucide-react";

import Sidebar from "../components/management/Sidebar";
import ManagementReauthGate from "../components/management/ManagementReauthGate";
import UpcomingAgendaAlerts from "../components/management/UpcomingAgendaAlerts";
import { getStaff, loginStaff, logoutStaff } from "../utils/authMock";
import api from "../../api/api.js";

import "../styles/management/management.css";
import "../styles/management/management-scroll.css";

const access = {
  OWNER: [
    "dashboard",
    "capacity-calculator",
    "pos",
    "booking-calendar",
    "orders",
    "installation-history",
    "payments",
    "categories",
    "products",
    "variants",
    "inventory",
    "stock-movements",
    "service-types",
    "service-requests",
    "technicians",
    "schedules",
    "customers",
    "feedback",
    "facebook-requests",
    "reports",
    "notifications",
    "audit-logs",
    "archive",
    "staff",
  ],
  MANAGER: [
    "dashboard",
    "capacity-calculator",
    "pos",
    "booking-calendar",
    "orders",
    "installation-history",
    "payments",
    "categories",
    "products",
    "variants",
    "inventory",
    "stock-movements",
    "service-types",
    "service-requests",
    "technicians",
    "schedules",
    "customers",
    "feedback",
    "facebook-requests",
    "reports",
    "notifications",
    "archive",
  ],
  SALES_CASHIER: ["pos", "notifications"],
  TECHNICIAN: [
    "dashboard",
    "capacity-calculator",
    "booking-calendar",
    "schedules",
    "notifications",
  ],
};

export default function ManagementLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState(() => getStaff());
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [unread, setUnread] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get("/api/management/auth/session")
      .then(({ data }) => {
        if (!active) return;

        const person = data.staff;

        if (!data.success || !person?.role) {
          setStaff(null);
          setSession(null);
          return;
        }

        loginStaff(person);
        setStaff(person);
        setSession(data.session);
      })
      .catch(() => {
        if (!active) return;

        logoutStaff();
        setStaff(null);
        setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const endSession = useCallback(() => {
    logoutStaff();
    setStaff(null);
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener("av-management-session-ended", endSession);

    return () =>
      window.removeEventListener("av-management-session-ended", endSession);
  }, [endSession]);

  useEffect(() => {
    // Do not send protected requests from a stale cached staff profile.
    // Wait until /auth/session has verified the active Management session.
    if (checking || !session?.id || !staff?.id) return undefined;

    let active = true;

    async function refresh() {
      try {
        const { data } = await api.get(
          "/api/management/workspace/notifications",
        );

        if (active) {
          setUnread(
            (data.items || []).filter((item) => !Number(item.isRead)).length,
          );
        }
      } catch {
        if (active) setUnread(0);
      }
    }

    refresh();

    const interval = window.setInterval(refresh, 60000);

    window.addEventListener("av-management-updated", refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("av-management-updated", refresh);
    };
  }, [checking, session?.id, staff?.id]);

  useEffect(() => {
    setOpen(false);
    // Recover from an old modal/drawer scroll lock when navigating between pages.
    document.body.style.overflow = "";
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;

    // The menu and its links have their own scroll area; do not lock the
    // whole document and strand a cashier or technician on a long page.
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", escape);

    return () => {
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function signOut() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await api.post("/api/management/auth/logout", {});

      endSession();

      navigate("/management/login", {
        replace: true,
      });
    } catch (error) {
      setLogoutError(
        error.response?.data?.message || "Could not sign out. Try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  if (checking) {
    return (
      <div className="mgmt-shell">
        <main className="mgmt-main" role="status">
          Checking management session…
        </main>
      </div>
    );
  }

  if (!staff || !session) {
    return <Navigate to="/management/login" replace />;
  }

  const slug = location.pathname.split("/")[2] || "dashboard";

  const allowed = access[staff.role] || [];

  if (!allowed.includes(slug)) {
    return (
      <Navigate
        to={
          staff.role === "SALES_CASHIER"
            ? "/management/pos"
            : "/management/dashboard"
        }
        replace
      />
    );
  }

  return (
    <div className="mgmt-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      {open && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="mgmt-workspace">
        <header className="mgmt-topbar">
          <button
            className="mgmt-menu"
            type="button"
            aria-label="Open management menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={19} />
            <span className="mgmt-menu-label">Menu</span>
          </button>

          <div>
            <b>AV Cooling Management</b>
            <span>
              {staff.role === "SALES_CASHIER"
                ? "Point of sale and walk-in bookings"
                : "Sales, inventory, service, and operations"}
            </span>
          </div>

          <div className="mgmt-top-actions">
            <Link
              className="mgmt-notification-link"
              to="/management/notifications"
              aria-label={`${unread} unread management notifications`}
              title="Notifications"
            >
              <Bell size={19} />

              {unread > 0 && (
                <span className="mgmt-notification-count">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>

            <span className="staff-chip">
              <UserRound size={16} />
              {staff.role.replaceAll("_", " ")}
            </span>

            <button
              type="button"
              className="mgmt-logout-button"
              title="Log out"
              aria-label="Log out"
              onClick={signOut}
              disabled={loggingOut}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {logoutError && (
          <p role="alert" className="wsm-error">
            {logoutError}
          </p>
        )}

        {staff.role !== "SALES_CASHIER" && (
          <UpcomingAgendaAlerts staff={staff} />
        )}

        <main className="mgmt-main">
          {slug === "staff" ? (
            <ManagementReauthGate session={session} onVerified={setSession}>
              <Outlet />
            </ManagementReauthGate>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
