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
} from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import "../../styles/management/archive-db.css";

const titles = {
  products: "Products",
  categories: "Product categories",
  variants: "Product variants",
  inventory: "Inventory",
  "service-types": "Service types",
  technicians: "Technicians",
  "facebook-requests": "Facebook requests",
};
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

export default function ArchivePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const hasLoadedRef = useRef(false);

  useRealtimeRefresh(["archive", "catalog", "inventory"], setRevision);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedRef.current) setLoading(true);
    api
      .get("/api/management/workspace/archive", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setItems(data.items || []);
          hasLoadedRef.current = true;
          setError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure.response?.data?.message || "Could not load the archive.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
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
  async function restore(entry) {
    if (
      !window.confirm(
        `Restore ${entry.label} to ${titles[entry.category] || entry.category}?`,
      )
    )
      return;
    setBusy(entry.id);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post(
        `/api/management/workspace/archive/${encodeURIComponent(entry.id)}/restore`,
        {},
      );
      if (!data.success) throw Error("Restore was not confirmed.");
      setMessage(data.message || "Record restored.");
      setDetail(null);
      setRevision((n) => n + 1);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (failure) {
      setError(
        failure.response?.data?.message ||
          failure.message ||
          "Could not restore record.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="av-archive-page">
      <header className="av-archive-head">
        <div>
          <span>
            <Archive size={17} /> RECORD RECOVERY
          </span>
          <h1>Archive</h1>
          <p>
            Removed catalog records live in MySQL, organized by their original
            module. View details or restore them here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      <div className="av-archive-note">
        <ShieldCheck size={18} />
        <span>
          Records remain recoverable for three years. Expired records are
          permanently erased only when database references allow it. Orders,
          payments, and service history are never deleted through this page.
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
          <Clock3 size={14} /> 3-year retention
        </span>
      </div>
      <div className="av-archive-controls">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived records"
            aria-label="Search archive"
          />
        </label>
        <div className="av-archive-categories" aria-label="Archive categories">
          <button
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
            : "No archived records yet. Use Archive on a product, category, variant, service type, or technician record."}
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
              <div className="av-archive-card-actions">
                <button type="button" onClick={() => setDetail(entry)}>
                  <Eye size={16} /> Details
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => restore(entry)}
                >
                  <ArchiveRestore size={16} />
                  {busy === entry.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {detail && (
        <div
          className="av-archive-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
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
              <dl>
                {(snapshotFields[detail.category] || []).map((field) => (
                  <div key={field}>
                    <dt>{field.replaceAll("_", " ")}</dt>
                    <dd>{String(detail.snapshot?.[field] ?? "—")}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Changes made while archived are not supported. Restore first to
                edit the live record.
              </p>
            </div>
            <footer>
              <button onClick={() => setDetail(null)}>Close</button>
              <button disabled={Boolean(busy)} onClick={() => restore(detail)}>
                <ArchiveRestore size={17} /> Restore record
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
