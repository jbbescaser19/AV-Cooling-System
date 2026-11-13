import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  Snowflake,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import Sidebar from "../components/management/Sidebar";
import ManagementReauthGate from "../components/management/ManagementReauthGate";
import UpcomingAgendaAlerts from "../components/management/UpcomingAgendaAlerts";
import { getStaff, loginStaff, logoutStaff } from "../utils/authMock";
import api from "../../api/api.js";

import "../styles/management/management.css";
import "../styles/management/management-notifications-popover.css";
import "../styles/management/management-brand-background.css";

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
  SALES_CASHIER: [
    "dashboard",
    "capacity-calculator",
    "pos",
    "booking-calendar",
    "orders",
    "installation-history",
    "payments",
    "products",
    "variants",
    "customers",
    "facebook-requests",
    "notifications",
    "schedules",
    "service-requests",
  ],
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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState("");
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

  const refreshNotificationOverview = useCallback(async () => {
    if (!staff?.id || !session) return;

    const { data } = await api.get(
      "/api/management/workspace/notifications/overview",
    );

    setRecentNotifications(Array.isArray(data.items) ? data.items : []);
    setUnread(Number(data.unreadCount) || 0);
    setLowStockCount(Number(data.lowStockCount) || 0);
    setLowStockItems(
      Array.isArray(data.lowStockItems) ? data.lowStockItems : [],
    );
    setNotificationError("");
  }, [staff?.id, session]);

  useEffect(() => {
    if (!staff?.id || !session) return undefined;

    const refresh = () => {
      refreshNotificationOverview().catch(() => {
        setNotificationError("Unable to refresh notifications.");
      });
    };

    refresh();

    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("av-management-updated", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("av-management-updated", refresh);
    };
  }, [staff?.id, session, refreshNotificationOverview]);

  async function notificationAction(path, method, confirmClear = false) {
    if (notificationBusy) return;

    if (
      confirmClear &&
      !window.confirm(
        "Delete all your saved notifications? Low-stock alerts will remain visible until restocked.",
      )
    ) {
      return;
    }

    setNotificationBusy(true);
    setNotificationError("");

    try {
      if (method === "delete") {
        await api.delete(path);
      } else {
        await api.patch(path, method === "read-one" ? { isRead: true } : {});
      }

      await refreshNotificationOverview();

      window.dispatchEvent(new Event("av-management-notifications-changed"));
    } catch (error) {
      setNotificationError(
        error.response?.data?.message || "Could not update notifications.",
      );
    } finally {
      setNotificationBusy(false);
    }
  }

  useEffect(() => {
    setOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", escape);

    return () => {
      document.body.style.overflow = previous;
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
    return <Navigate to="/management/dashboard" replace />;
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

          <div className="mgmt-topbar-identity">
            <Link
              to="/"
              className="mgmt-topbar-brand"
              aria-label="AV Cooling storefront"
            >
              <span className="mgmt-brand-logo">
                <Snowflake size={20} aria-hidden="true" />
              </span>

              <span className="mgmt-brand-copy">
                <b>AV Cooling</b>
                <small>Sales &amp; Service</small>
              </span>
            </Link>
          </div>

          <div className="mgmt-top-actions">
            <div className="av-notify-wrap">
              <button
                className="mgmt-notification-link"
                type="button"
                aria-label={`${unread} unread management notifications`}
                aria-expanded={notificationOpen}
                aria-controls="av-management-notification-popover"
                title="Open notifications"
                onClick={() => setNotificationOpen((value) => !value)}
              >
                <Bell size={19} />

                {unread > 0 && (
                  <span className="mgmt-notification-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div
                  className="av-notify-popover"
                  id="av-management-notification-popover"
                  role="region"
                  aria-label="Management notifications"
                >
                  <div className="av-notify-popover__head">
                    <strong>Notifications</strong>

                    <button
                      type="button"
                      onClick={() => setNotificationOpen(false)}
                      aria-label="Close notifications"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {notificationError && (
                    <p className="av-notify-error" role="alert">
                      {notificationError}
                    </p>
                  )}

                  {lowStockCount > 0 &&
                    ["OWNER", "MANAGER"].includes(staff.role) && (
                      <Link
                        className="av-stock-popover-warning"
                        to="/management/inventory"
                        onClick={() => setNotificationOpen(false)}
                      >
                        <AlertTriangle size={20} aria-hidden="true" />

                        <span>
                          <strong>{lowStockCount} need restocking</strong>

                          <small>
                            {lowStockItems
                              .slice(0, 2)
                              .map((item) => item.name)
                              .join(" · ")}
                            {lowStockCount > 2 ? " · View all inventory" : ""}
                          </small>
                        </span>
                      </Link>
                    )}

                  <div className="av-notify-popover__tools">
                    <button
                      type="button"
                      disabled={notificationBusy || unread === 0}
                      onClick={() =>
                        notificationAction(
                          "/api/management/workspace/notifications/read-all",
                          "patch",
                        )
                      }
                    >
                      <CheckCheck size={15} />
                      Mark all read
                    </button>

                    <button
                      type="button"
                      disabled={notificationBusy || !recentNotifications.length}
                      onClick={() =>
                        notificationAction(
                          "/api/management/workspace/notifications/clear",
                          "delete",
                          true,
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Clear all
                    </button>
                  </div>

                  {recentNotifications.length === 0 ? (
                    <p className="av-notify-popover__empty">
                      No saved notifications.
                    </p>
                  ) : (
                    recentNotifications.map((notice) => (
                      <div
                        className={`av-notify-popover__item ${
                          Number(notice.isRead)
                            ? ""
                            : "av-notify-popover__item--unread"
                        }`}
                        key={notice.id}
                      >
                        <strong>{notice.title || "New update"}</strong>

                        <span>
                          {notice.message ||
                            "View the notification for more information."}
                        </span>

                        <div className="av-notify-popover__item-actions">
                          {!Number(notice.isRead) && (
                            <button
                              type="button"
                              disabled={notificationBusy}
                              onClick={() =>
                                notificationAction(
                                  `/api/management/workspace/notifications/${notice.id}`,
                                  "read-one",
                                )
                              }
                            >
                              <CheckCheck size={14} />
                              Mark read
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={notificationBusy}
                            onClick={() =>
                              notificationAction(
                                `/api/management/workspace/notifications/${notice.id}`,
                                "delete",
                              )
                            }
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <Link
                    className="av-notify-popover__all"
                    to="/management/notifications"
                    onClick={() => setNotificationOpen(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

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

        {lowStockCount > 0 && ["OWNER", "MANAGER"].includes(staff.role) && (
          <Link to="/management/inventory" className="av-restock-strip">
            <AlertTriangle size={17} aria-hidden="true" />

            <span>
              <strong>Restock needed:</strong> {lowStockCount} aircon variant(s)
              at or below reorder level
            </span>

            <span className="av-restock-strip__action">View inventory</span>
          </Link>
        )}

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
