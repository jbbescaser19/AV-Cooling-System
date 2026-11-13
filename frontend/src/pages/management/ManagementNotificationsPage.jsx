import { confirmAction } from "../../utils/confirmAction.js";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  RefreshCw,
  Trash2,
} from "lucide-react";
import api from "../../../api/api.js";

const endpoint = "/api/management/workspace/notifications";

function readableDate(date) {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "" : value.toLocaleString("en-PH");
}

export default function ManagementNotificationsPage() {
  const [records, setRecords] = useState([]);
  const [stock, setStock] = useState([]);
  const [stockCount, setStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const [all, overview] = await Promise.all([
      api.get(endpoint),
      api.get(`${endpoint}/overview`),
    ]);
    setRecords(Array.isArray(all.data.items) ? all.data.items : []);
    setStock(
      Array.isArray(overview.data.lowStockItems)
        ? overview.data.lowStockItems
        : [],
    );
    setStockCount(Number(overview.data.lowStockCount) || 0);
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load notifications.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const refresh = () => reload().catch(() => {});
    window.addEventListener("av-management-notifications-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener(
        "av-management-notifications-changed",
        refresh,
      );
    };
  }, [reload]);

  async function act(method, path, body = null, confirmClear = false) {
    if (busy) return;
    if (
      confirmClear &&
      !(await confirmAction(
        "Delete all your saved notifications? Active low-stock warnings will stay visible.",
      ))
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response =
        method === "delete"
          ? await api.delete(`${endpoint}${path}`)
          : await api.patch(`${endpoint}${path}`, body || {});
      await reload();
      setNotice(response.data?.message || "Notifications updated.");
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (e) {
      setError(e.response?.data?.message || "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="av-notification-center">
      <header className="av-notification-center__header">
        <div>
          <span className="av-notification-center__eyebrow">
            <Bell size={15} /> MANAGEMENT ALERTS
          </span>
          <h1>Notifications</h1>
          <p>
            Updates for your staff account and inventory that needs attention.
          </p>
        </div>
        <div className="av-notification-center__actions">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => {
              setLoading(true);
              reload()
                .catch((e) =>
                  setError(e.response?.data?.message || "Unable to refresh."),
                )
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            disabled={busy || !records.some((row) => !Number(row.isRead))}
            onClick={() => act("patch", "/read-all")}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
          <button
            type="button"
            className="av-notification-center__danger"
            disabled={busy || records.length === 0}
            onClick={() => act("delete", "/clear", null, true)}
          >
            <Trash2 size={16} /> Clear all
          </button>
        </div>
      </header>

      {error && (
        <p className="wsm-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="wsm-success" role="status">
          {notice}
        </p>
      )}

      {stockCount > 0 && (
        <section
          className="av-notification-center__stock"
          aria-label="Restock reminders"
        >
          <header>
            <div>
              <AlertTriangle size={20} /> <strong>Restock needed</strong>
            </div>
            <span>{stockCount} low or out of stock</span>
          </header>
          <p>
            This is a live inventory warning. Clearing notifications will not
            hide it. It disappears after stock is replenished.
          </p>
          <div className="av-notification-center__stock-list">
            {stock.map((item) => (
              <div key={item.id}>
                <span>{item.name}</span>
                <strong>
                  {Number(item.available) <= 0
                    ? "Out of stock"
                    : `${item.available} left`}
                </strong>
                <small>Reorder at {item.reorderLevel}</small>
              </div>
            ))}
          </div>
          <Link to="/management/inventory">Open Inventory to restock</Link>
        </section>
      )}

      <div
        className="av-notification-center__list"
        aria-label="Saved notifications"
      >
        {loading ? (
          <p role="status">Loading notifications…</p>
        ) : records.length === 0 ? (
          <div className="av-notification-center__empty">
            <Bell size={26} />
            <strong>No saved notifications</strong>
            <p>
              New activity will appear here. Low-stock warnings are tracked
              separately.
            </p>
          </div>
        ) : (
          records.map((item) => (
            <article
              className={`av-notification-center__item ${Number(item.isRead) ? "" : "is-unread"}`}
              key={item.id}
            >
              <div className="av-notification-center__item-main">
                <div className="av-notification-center__title">
                  <strong>{item.title}</strong>
                  {!Number(item.isRead) && <span>NEW</span>}
                </div>
                <p>{item.message}</p>
                <small>{readableDate(item.createdAt)}</small>
              </div>
              <div className="av-notification-center__item-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act("patch", `/${item.id}`, {
                      isRead: !Number(item.isRead),
                    })
                  }
                >
                  <CheckCheck size={15} />{" "}
                  {Number(item.isRead) ? "Mark unread" : "Mark read"}
                </button>
                <button
                  type="button"
                  className="av-notification-center__danger"
                  disabled={busy}
                  onClick={() => act("delete", `/${item.id}`)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {records.length === 100 && (
        <p className="av-notification-center__note">
          Showing the latest 100 notifications.
        </p>
      )}
    </section>
  );
}
