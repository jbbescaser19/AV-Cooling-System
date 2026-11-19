import { useEffect, useMemo, useRef, useState } from "react";

import {
  Archive,
  ArchiveRestore,
  Eye,
  Search,
  X,
  Clock3,
  ShieldCheck,
  RefreshCw,
  UserRoundX,
} from "lucide-react";

import api from "../../../api/api.js";

import { getStaff } from "../../utils/authMock.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";

import PermanentArchiveDelete from "../../components/management/PermanentArchiveDelete.jsx";

import "../../styles/management/archive-db.css";

const titles = {
  products: "Products",
  categories: "Product Categories",
  variants: "Product Variants",
  inventory: "Inventory",
  "service-types": "Service Types",
  technicians: "Technicians",
  "facebook-requests": "Facebook Agreements",
  "customer-accounts": "Customer Accounts",
  "staff-accounts": "Staff Accounts",
};

const isAccount = (entry) =>
  ["customer-accounts", "staff-accounts"].includes(entry.category);

const canRestore = (entry) =>
  !isAccount(entry) || entry.snapshot?.restorable === true;

const formatted = (date) => {
  if (!date) return "—";

  const value = new Date(date);

  return Number.isNaN(value.getTime())
    ? "—"
    : value.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const snapshotFields = {
  products: ["product_name", "brand", "model", "category_id", "status"],
  categories: ["category_name", "description", "status"],
  variants: ["product_id", "horsepower", "srp", "promo_price", "status"],
  "service-types": [
    "service_name",
    "service_code",
    "description",
    "base_price",
    "status",
  ],
  technicians: ["technician_code", "status"],
  "facebook-requests": [
    "customer_name",
    "contact_number",
    "request_kind",
    "status",
  ],
};

const actionLayout = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const fullWidthAction = {
  gridColumn: "1 / -1",
  display: "flex",
};

export default function ArchivePage() {
  const isOwner = getStaff()?.role === "OWNER";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  const loadedOnce = useRef(false);
  const restoring = useRef(false);

  useRealtimeRefresh(["archive"], setRevision);

  useEffect(() => {
    const controller = new AbortController();

    if (!loadedOnce.current) {
      setLoading(true);
    }

    api
      .get("/api/management/workspace/archive", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        const records = data.items || [];

        setItems(records);

        setDetail((previous) =>
          previous
            ? records.find((entry) => entry.id === previous.id) || null
            : null,
        );

        loadedOnce.current = true;
        setLoading(false);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(
            failure.response?.data?.message || "Could not load the archive.",
          );
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [revision]);

  const counts = useMemo(
    () =>
      items.reduce((out, item) => {
        const source = item.sourceModule || item.category;

        out[source] = (out[source] || 0) + 1;

        return out;
      }, {}),
    [items],
  );

  const visible = items.filter(
    (entry) =>
      (category === "all" ||
        (entry.sourceModule || entry.category) === category) &&
      `${entry.label} ${entry.recordId} ${entry.deletedBy || ""}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );

  function handleDeleted(text) {
    setError("");
    setMessage(text || "Record permanently deleted.");
    setDetail(null);

    setRevision((count) => count + 1);
  }

  function handleError(text) {
    setError(text);
    setMessage("");
    setDetail(null);
  }

  async function restore(entry) {
    if (
      busy ||
      restoring.current ||
      !canRestore(entry) ||
      (isAccount(entry) && !isOwner)
    ) {
      return;
    }

    restoring.current = true;
    setBusy(entry.id);
    setError("");
    setMessage("");

    try {
      const approved = await confirmAction({
        title: "Restore archived record?",
        message: isAccount(entry)
          ? `Restore ${entry.label}'s account? Previously cancelled orders and services will remain cancelled.`
          : `Restore ${entry.label} to ${
              titles[entry.category] || entry.category
            }?`,
        confirmText: "Restore",
      });

      if (!approved) return;

      const { data } = await api.post(
        `/api/management/workspace/archive/${encodeURIComponent(entry.id)}/restore`,
        {},
      );

      if (!data.success) {
        throw new Error("Restore was not confirmed.");
      }

      setItems((previous) => previous.filter((item) => item.id !== entry.id));

      setMessage(data.message || "Record restored.");

      setDetail(null);

      setRevision((count) => count + 1);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (failure) {
      handleError(
        failure.response?.data?.message ||
          failure.message ||
          "Could not restore record.",
      );
    } finally {
      restoring.current = false;
      setBusy("");
    }
  }

  function renderRestore(entry) {
    const allowed = canRestore(entry) && (!isAccount(entry) || isOwner);

    return (
      <button
        type="button"
        disabled={Boolean(busy) || !allowed}
        onClick={() => restore(entry)}
        title={
          allowed
            ? "Restore this archived record"
            : "Previous account information is unavailable or restoration is restricted."
        }
        style={{
          background: "#0a7193",
          color: "#ffffff",
          borderColor: "#0a7193",
          opacity: !allowed || busy ? 0.55 : 1,
          cursor: !allowed || busy ? "not-allowed" : "pointer",
        }}
      >
        <ArchiveRestore size={16} />
        Restore
      </button>
    );
  }

  function renderPermanentDelete(entry) {
    return (
      <PermanentArchiveDelete
        entry={entry}
        busy={busy}
        setBusy={setBusy}
        onError={handleError}
        onDeleted={(text) => {
          setItems((previous) =>
            previous.filter((item) => item.id !== entry.id),
          );

          handleDeleted(text);
        }}
      />
    );
  }

  return (
    <div className="av-archive-page">
      <header className="av-archive-head">
        <div>
          <span>
            <Archive size={17} />
            RECORD RECOVERY
          </span>

          <h1>Archive</h1>

          <p>
            Restore archived records or permanently delete records you no longer
            need.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || Boolean(busy)}
          onClick={() => {
            setError("");
            setRevision((count) => count + 1);
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <div className="av-archive-note">
        <ShieldCheck size={18} />

        <span>
          Archived records can be restored during their retention period.
          Permanent deletion is restricted to the Owner and cannot be undone.
          Historical transactions remain protected.
        </span>
      </div>

      {error && (
        <p className="wsm-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="wsm-success" role="status">
          {message}
        </p>
      )}

      <div className="av-archive-summary">
        <strong>{items.length} archived</strong>

        <span>{Object.keys(counts).length} categories</span>

        <span>
          <Clock3 size={14} />
          3-year retention
        </span>
      </div>

      <div className="av-archive-controls">
        <label>
          <Search size={17} />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search archived records"
            aria-label="Search archive"
          />
        </label>

        <div className="av-archive-categories" aria-label="Archive categories">
          <button
            type="button"
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
          >
            All ({items.length})
          </button>

          {Object.entries(counts)
            .sort()
            .map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={category === key ? "active" : ""}
                onClick={() => setCategory(key)}
              >
                {titles[key] || key} ({count})
              </button>
            ))}
        </div>
      </div>

      {loading ? (
        <p className="av-archive-empty" role="status">
          Loading archive…
        </p>
      ) : !visible.length ? (
        <p className="av-archive-empty">
          {items.length
            ? "No records match your filters."
            : "No archived records yet."}
        </p>
      ) : (
        <div className="av-archive-grid">
          {visible.map((entry) => (
            <article className="av-archive-card" key={entry.id}>
              <div className="av-archive-card-top">
                <span>
                  {titles[entry.sourceModule || entry.category] ||
                    entry.category}
                </span>

                <span>#{entry.recordId}</span>
              </div>

              <h2>{entry.label}</h2>

              <p>Archived {formatted(entry.deletedAt)}</p>

              <p>By {entry.deletedBy || "Management staff"}</p>

              <p>Retention ends {formatted(entry.purgeAfter)}</p>

              {isAccount(entry) && (
                <p className="av-archive-account-tag">
                  <UserRoundX size={13} />

                  {canRestore(entry)
                    ? "Restorable account"
                    : "Previously anonymized"}
                </p>
              )}

              {!canRestore(entry) && (
                <p>
                  The original login information was permanently removed before
                  this update.
                </p>
              )}

              <div className="av-archive-card-actions" style={actionLayout}>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => setDetail(entry)}
                >
                  <Eye size={16} />
                  Details
                </button>

                {renderRestore(entry)}

                {isOwner && (
                  <div style={fullWidthAction}>
                    {renderPermanentDelete(entry)}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <div
          className="av-archive-overlay"
          onMouseDown={(event) => {
            if (!busy && event.target === event.currentTarget) {
              setDetail(null);
            }
          }}
        >
          <section
            className="av-archive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-detail-heading"
          >
            <header>
              <div>
                <span>{titles[detail.category] || detail.category}</span>

                <h2 id="archive-detail-heading">{detail.label}</h2>
              </div>

              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setDetail(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </header>

            <div className="av-archive-dialog-body">
              <p>
                Record #{detail.recordId} · Archived{" "}
                {formatted(detail.deletedAt)} · By{" "}
                {detail.deletedBy || "Management"}
              </p>

              {isAccount(detail) ? (
                <>
                  <p>
                    {canRestore(detail)
                      ? "This account can be restored or permanently deleted."
                      : "The previous deletion process permanently removed the login information. This account cannot be restored."}
                  </p>

                  <dl>
                    <div>
                      <dt>Account ID</dt>
                      <dd>#{detail.recordId}</dd>
                    </div>

                    <div>
                      <dt>Previous status</dt>
                      <dd>{detail.previousStatus || "—"}</dd>
                    </div>

                    <div>
                      <dt>Recovery status</dt>
                      <dd>
                        {canRestore(detail) ? "Restorable" : "Not restorable"}
                      </dd>
                    </div>

                    {detail.category === "staff-accounts" ? (
                      <div>
                        <dt>Previous role</dt>
                        <dd>
                          {String(
                            detail.snapshot?.previousRole || "—",
                          ).replaceAll("_", " ")}
                        </dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt>Cancelled orders</dt>
                          <dd>
                            {(detail.snapshot?.cancelledOrderIds || []).join(
                              ", ",
                            ) || "None"}
                          </dd>
                        </div>

                        <div>
                          <dt>Cancelled services</dt>
                          <dd>
                            {(detail.snapshot?.cancelledServiceIds || []).join(
                              ", ",
                            ) || "None"}
                          </dd>
                        </div>

                        <div>
                          <dt>Preserved order history</dt>
                          <dd>
                            {detail.snapshot?.completedOrCancelledOrdersKept ??
                              "—"}
                          </dd>
                        </div>

                        <div>
                          <dt>Preserved service history</dt>
                          <dd>
                            {detail.snapshot
                              ?.completedOrCancelledServicesKept ?? "—"}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                </>
              ) : (
                <dl>
                  {(snapshotFields[detail.category] || []).map((field) => (
                    <div key={field}>
                      <dt>{field.replaceAll("_", " ")}</dt>

                      <dd>{String(detail.snapshot?.[field] ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <footer style={actionLayout}>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setDetail(null)}
              >
                Close
              </button>

              {renderRestore(detail)}

              {isOwner && (
                <div style={fullWidthAction}>
                  {renderPermanentDelete(detail)}
                </div>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
