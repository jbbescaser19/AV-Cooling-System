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
import ManagementSessionGuard from "../components/management/ManagementSessionGuard";
import ManagementReauthGate from "../components/management/ManagementReauthGate";
import { getStaff, loginStaff, logoutStaff } from "../utils/authMock";
import api from "../../api/api.js";
import "../styles/management/management.css";

const access = {
  OWNER: [
    "dashboard",
    "pos",
    "booking-calendar",
    "orders",
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
    "pos",
    "booking-calendar",
    "orders",
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
  SALES_CASHIER: [
    "dashboard",
    "pos",
    "booking-calendar",
    "orders",
    "payments",
    "products",
    "variants",
    "customers",
    "facebook-requests",
    "notifications",
    "schedules",
  ],
  TECHNICIAN: ["dashboard", "booking-calendar", "schedules", "notifications"],
};
export default function ManagementLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false),
    [staff, setStaff] = useState(() => getStaff()),
    [session, setSession] = useState(null),
    [checking, setChecking] = useState(true),
    [unread, setUnread] = useState(0),
    [logoutError, setLogoutError] = useState(""),
    [loggingOut, setLoggingOut] = useState(false);
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
        if (active) {
          logoutStaff();
          setStaff(null);
          setSession(null);
        }
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
    if (!staff) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const { data } = await api.get(
          "/api/management/workspace/notifications",
        );
        if (active)
          setUnread((data.items || []).filter((x) => !Number(x.isRead)).length);
      } catch {
        if (active) setUnread(0);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("av-management-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("av-management-updated", refresh);
    };
  }, [staff?.id]);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await api.post("/api/management/auth/logout", {});
      endSession();
      navigate("/management/login", { replace: true });
    } catch (e) {
      setLogoutError(
        e.response?.data?.message || "Could not sign out. Try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  if (checking)
    return (
      <div className="mgmt-shell">
        <main className="mgmt-main" role="status">
          Checking management session…
        </main>
      </div>
    );
  if (!staff || !session) return <Navigate to="/management/login" replace />;
  const slug = location.pathname.split("/")[2] || "dashboard";
  if (!(access[staff.role] || []).includes(slug))
    return <Navigate to="/management/dashboard" replace />;
  return (
    <ManagementSessionGuard
      session={session}
      onActivity={setSession}
      onExpired={endSession}
    >
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
              <span>Sales, inventory, service, and operations</span>
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
    </ManagementSessionGuard>
  );
}
