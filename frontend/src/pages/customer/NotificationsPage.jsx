import { confirmAction } from "../../utils/confirmAction.js";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  Package,
  Trash2,
  Wrench,
  ArrowUpRight,
} from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import "../../styles/customer/customer-notifications.css";

function target(notice) {
  if (/^\/account\/orders\/AV-[A-F0-9]{32}$/.test(notice.targetPath || ""))
    return notice.targetPath;
  if (/^\/account\/services\/[1-9]\d*$/.test(notice.targetPath || ""))
    return notice.targetPath;
  return notice.type?.startsWith("ORDER_") ||
    notice.type?.startsWith("INSTALLATION_") ||
    notice.type?.startsWith("PAYMENT_") ||
    notice.type === "SCHEDULE_CHANGED" ||
    notice.type === "EXTRA_CHARGES_PROPOSED"
    ? "/account/orders"
    : notice.type?.startsWith("SERVICE_")
      ? "/account/services"
      : "/account/notifications";
}
function dateText(value) {
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? ""
    : time.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
function NotificationIcon({ type }) {
  return type.startsWith("SERVICE_") ? (
    <Wrench size={18} aria-hidden="true" />
  ) : type.startsWith("ORDER_") || type.startsWith("INSTALLATION_") ? (
    <Package size={18} aria-hidden="true" />
  ) : (
    <Bell size={18} aria-hidden="true" />
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useRealtimeRefresh(["notifications"], setRefresh);
  const [confirmClear, setConfirmClear] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy && !confirmClear) {
        setRefresh((count) => count + 1);
      }
    }, 45000);
    return () => window.clearInterval(timer);
  }, [busy, confirmClear]);

  function notifyBadge() {
    window.dispatchEvent(new Event("av-notifications-changed"));
  }
  useEffect(() => {
    const controller = new AbortController();
    const current = ++version.current;
    setLoading(true);
    setError("");
    setNotifications([]);
    setPage(1);
    api
      .get("/api/customer/notifications", {
        params: { filter, page: 1 },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted || current !== version.current) return;
        setNotifications(data.notifications || []);
        setUnread(Number(data.unreadCount || 0));
        setHasMore(Boolean(data.hasMore));
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.response?.data?.message || "Unable to load notifications.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && current === version.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [filter, refresh]);

  async function openNotice(notice) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!notice.isRead) {
        await api.patch(`/api/customer/notifications/${notice.id}/read`);
        notifyBadge();
      }
      navigate(target(notice));
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to open notification. Please retry.",
      );
      setBusy(false);
    }
  }
  async function markOne(notice) {
    if (busy || notice.isRead) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch(
        `/api/customer/notifications/${notice.id}/read`,
      );
      setUnread(Number(data.unreadCount || 0));
      setNotifications((old) =>
        filter === "unread"
          ? old.filter((item) => item.id !== notice.id)
          : old.map((item) =>
              item.id === notice.id ? { ...item, isRead: true } : item,
            ),
      );
      notifyBadge();
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to mark notification as read.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function markAll() {
    if (busy || !unread) return;
    setBusy(true);
    setError("");
    try {
      await api.patch("/api/customer/notifications/read-all");
      setUnread(0);
      setNotifications((old) =>
        filter === "unread"
          ? []
          : old.map((item) => ({ ...item, isRead: true })),
      );
      notifyBadge();
    } catch (e) {
      setError(e.response?.data?.message || "Unable to mark all as read.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteOne(notice) {
    if (busy || !(await confirmAction("Delete this notification permanently?")))
      return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/api/customer/notifications/${notice.id}`);
      notifyBadge();
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e.response?.data?.message || "Unable to delete notification.");
    } finally {
      setBusy(false);
    }
  }
  async function clearAll() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("/api/customer/notifications/clear-all");
      setNotifications([]);
      setUnread(0);
      setHasMore(false);
      setConfirmClear(false);
      notifyBadge();
    } catch (e) {
      setError(e.response?.data?.message || "Unable to clear notifications.");
    } finally {
      setBusy(false);
    }
  }
  async function loadMore() {
    if (busy || loading || !hasMore) return;
    const current = version.current;
    setBusy(true);
    try {
      const next = page + 1;
      const { data } = await api.get("/api/customer/notifications", {
        params: { filter, page: next },
      });
      if (version.current !== current) return;
      setNotifications((old) => [
        ...old,
        ...(data.notifications || []).filter(
          (item) => !old.some((v) => v.id === item.id),
        ),
      ]);
      setPage(next);
      setHasMore(Boolean(data.hasMore));
      setUnread(Number(data.unreadCount || 0));
    } catch (e) {
      setError(
        e.response?.data?.message || "Unable to load more notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="customer-module customer-notification-center">
      <CustomerPageHeader
        Icon={Bell}
        title="Notifications"
        copy="Real updates about your aircon orders, installation, payments and services."
      />
      <div className="notification-toolbar">
        <div
          className="notification-filters"
          role="group"
          aria-label="Notification filters"
        >
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filter === "unread" ? "active" : ""}
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            Unread {unread ? `(${unread})` : ""}
          </button>
        </div>
        <div className="notification-toolbar-actions">
          <button
            type="button"
            onClick={markAll}
            disabled={busy || loading || !unread}
          >
            <CheckCheck size={15} /> Mark all read
          </button>
          <button
            type="button"
            className="notification-danger-link"
            onClick={() => setConfirmClear(true)}
            disabled={busy || loading}
          >
            <Trash2 size={15} /> Clear all
          </button>
        </div>
      </div>
      {error && (
        <div className="notification-error" role="alert">
          {error}
          <button type="button" onClick={() => setRefresh((v) => v + 1)}>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p className="notification-feedback" role="status">
          Loading notifications…
        </p>
      ) : notifications.length === 0 ? (
        <div className="surface notification-empty">
          <ClipboardList size={24} />
          <strong>
            {filter === "unread" ? "All caught up" : "No notifications"}
          </strong>
          <p>New order and service updates will appear here.</p>
        </div>
      ) : (
        <div className="notification-cards">
          {notifications.map((notice) => (
            <article
              className={`surface notification-card${notice.isRead ? "" : " unread"}`}
              key={notice.id}
            >
              <div className="notification-card-icon">
                <NotificationIcon type={notice.type || ""} />
              </div>
              <div className="notification-card-content">
                <div className="notification-card-top">
                  <button
                    type="button"
                    className="notification-title-button"
                    disabled={busy}
                    onClick={() => openNotice(notice)}
                  >
                    <CustomerStatusBadge status={notice.type}>
                      {notice.title}
                    </CustomerStatusBadge>
                  </button>
                  {!notice.isRead && (
                    <span className="notification-unread-dot" title="Unread" />
                  )}
                </div>
                <p>{notice.message}</p>
                <time dateTime={notice.createdAt}>
                  {dateText(notice.createdAt)}
                </time>
                <div className="notification-card-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openNotice(notice)}
                  >
                    <ArrowUpRight size={14} /> Open details
                  </button>
                  {!notice.isRead && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => markOne(notice)}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    className="notification-remove"
                    onClick={() => deleteOne(notice)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && hasMore && (
        <button
          type="button"
          className="notification-load-more"
          disabled={busy}
          onClick={loadMore}
        >
          Load more
        </button>
      )}
      {confirmClear && (
        <div className="notification-confirm-backdrop" role="presentation">
          <section
            className="notification-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-notifications-title"
          >
            <h2 id="clear-notifications-title">Delete all notifications?</h2>
            <p>
              This permanently removes all notifications from your account,
              including older read notifications. Your orders and service
              records are not deleted.
            </p>
            <div className="notification-confirm-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmClear(false)}
              >
                Keep notifications
              </button>
              <button
                type="button"
                disabled={busy}
                className="notification-confirm-delete"
                onClick={clearAll}
              >
                {busy ? "Deleting…" : "Delete all"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
