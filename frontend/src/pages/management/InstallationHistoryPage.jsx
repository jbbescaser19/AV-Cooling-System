import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Search,
  ClipboardCheck,
  Wrench,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  X,
  FilterX,
} from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import "../../styles/management/installation-history.css";

const peso = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const dateText = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
};

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function CompletedJobModal({ record, onClose }) {
  const closeButton = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const controls = Array.from(
        panel.current.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!controls.length) {
        event.preventDefault();
        panel.current.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const fields = [
    [
      "Job category",
      record.category === "INSTALLATION" ? "Installation" : "Service",
    ],
    ["Source", record.source],
    ["Customer", record.customer],
    ["Contact number", record.contactNumber],
    ["Service / installation address", record.address],
    ["Aircon, model and capacity", record.aircon],
    ["Scheduled appointment", record.scheduledAt],
    ["Completed on", dateText(record.completedAt)],
    ["Technician team", record.team],
    ["Payment method", record.paymentMethod],
    ["Payment status", record.paymentStatus],
    ["Recorded amount", peso(record.amount)],
  ];

  return createPortal(
    <div
      className="install-history__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="install-history__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completed-job-modal-title"
        ref={panel}
        tabIndex={-1}
      >
        <header className="install-history__modal-head">
          <div>
            <span
              className={`install-history__tag is-${record.category?.toLowerCase()}`}
            >
              {record.category === "INSTALLATION" ? "Installation" : "Service"}
            </span>
            <h2 id="completed-job-modal-title">{record.reference}</h2>
            <p>Completed {dateText(record.completedAt)}</p>
          </div>
          <button
            type="button"
            className="install-history__modal-close"
            ref={closeButton}
            onClick={onClose}
            aria-label="Close job details"
          >
            <X size={20} />
          </button>
        </header>
        <div className="install-history__modal-body">
          <dl className="install-history__detail-grid">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Not recorded"}</dd>
              </div>
            ))}
          </dl>
          <section className="install-history__completion-report">
            <h3>Completion summary</h3>
            <p>{record.summary || "No completion summary recorded."}</p>
          </section>
        </div>
        <footer className="install-history__modal-footer">
          <button type="button" onClick={onClose}>
            Close details
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default function InstallationHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [month, setMonth] = useState(todayDate().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [date, setDate] = useState(todayDate());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(16);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ INSTALLATION: 0, SERVICE: 0 });
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const hasLoadedRef = useRef(false);

  useRealtimeRefresh(["jobs", "services", "orders"], setRevision);
  const closeModal = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const dateError =
    period === "MONTH" && !/^\d{4}-\d{2}$/.test(month)
      ? "Choose a month."
      : period === "YEAR" &&
          (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)
        ? "Enter a year between 1900 and 2100."
        : period === "DATE" && !date
          ? "Choose a completion date."
          : period === "RANGE" && !from && !to
            ? "Choose a start date, an end date, or both."
            : period === "RANGE" && from && to && from > to
              ? "The end date must be on or after the start date."
              : "";

  useEffect(() => {
    if (dateError) {
      setItems([]);
      setTotal(0);
      setCounts({ INSTALLATION: 0, SERVICE: 0 });
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    if (!hasLoadedRef.current) setLoading(true);
    setError("");
    const params = { category, period, page, search: debouncedSearch };
    if (period === "MONTH") params.month = month;
    if (period === "YEAR") params.year = year;
    if (period === "DATE") params.date = date;
    if (period === "RANGE") {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    api
      .get("/api/management/sales/completed-installations", {
        params,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setItems(data.installations || []);
        hasLoadedRef.current = true;
        setTotal(Number(data.total) || 0);
        setPageSize(Number(data.pageSize) || 16);
        setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        setCounts(data.counts || { INSTALLATION: 0, SERVICE: 0 });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Keep previously loaded records visible if a background request fails.
        setError(err.response?.data?.message || "Cannot load completed jobs.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    category,
    period,
    month,
    year,
    date,
    from,
    to,
    page,
    debouncedSearch,
    revision,
    dateError,
  ]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
    setSelected(null);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategory("ALL");
    setPeriod("ALL");
    setMonth(todayDate().slice(0, 7));
    setYear(String(new Date().getFullYear()));
    setDate(todayDate());
    setFrom("");
    setTo("");
    setPage(1);
    setSelected(null);
  }

  const startIndex = total ? (page - 1) * pageSize + 1 : 0;
  const endIndex = total ? Math.min(page * pageSize, total) : 0;

  return (
    <main className="install-history">
      <header className="install-history__head">
        <div>
          <span className="install-history__eyebrow">SERVICE OPERATIONS</span>
          <h1>Completed Jobs History</h1>
          <p>
            Review finished installations and services. Search any month, year
            or exact completion date.
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

      <div className="install-history__totals" aria-live="polite">
        <div>
          <ClipboardCheck size={18} />
          <span>
            <strong>{counts.INSTALLATION || 0}</strong> installations
          </span>
        </div>
        <div>
          <Wrench size={18} />
          <span>
            <strong>{counts.SERVICE || 0}</strong> services
          </span>
        </div>
      </div>

      <div className="install-history__filters">
        <label className="install-history__search">
          <span>Search history</span>
          <div className="install-history__input-icon">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => changeFilter(setSearch, e.target.value)}
              maxLength={100}
              placeholder="Customer, reference, model or team"
            />
          </div>
        </label>
        <label>
          <span>Job type</span>
          <select
            value={category}
            onChange={(e) => changeFilter(setCategory, e.target.value)}
          >
            <option value="ALL">All completed jobs</option>
            <option value="INSTALLATION">Installations</option>
            <option value="SERVICE">Services</option>
          </select>
        </label>
        <label>
          <span>Completed date</span>
          <div className="install-history__input-icon">
            <CalendarDays size={16} />
            <select
              value={period}
              onChange={(e) => changeFilter(setPeriod, e.target.value)}
            >
              <option value="ALL">All dates</option>
              <option value="MONTH">Choose month</option>
              <option value="YEAR">Choose year</option>
              <option value="DATE">Specific date</option>
              <option value="RANGE">Custom date range</option>
            </select>
          </div>
        </label>
      </div>

      {period !== "ALL" && (
        <div className="install-history__date-fields">
          {period === "MONTH" && (
            <label>
              Month and year
              <input
                type="month"
                value={month}
                min="1900-01"
                max="2100-12"
                onChange={(e) => changeFilter(setMonth, e.target.value)}
              />
            </label>
          )}
          {period === "YEAR" && (
            <label>
              Year (e.g., 2007)
              <input
                type="number"
                min="1900"
                max="2100"
                step="1"
                value={year}
                onChange={(e) => changeFilter(setYear, e.target.value)}
              />
            </label>
          )}
          {period === "DATE" && (
            <label>
              Exact date (e.g., Oct 18, 2017)
              <input
                type="date"
                value={date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => changeFilter(setDate, e.target.value)}
              />
            </label>
          )}
          {period === "RANGE" && (
            <>
              <label>
                From date (optional)
                <input
                  type="date"
                  value={from}
                  min="1900-01-01"
                  max="2100-12-31"
                  onChange={(e) => changeFilter(setFrom, e.target.value)}
                />
              </label>
              <label>
                To date (optional)
                <input
                  type="date"
                  value={to}
                  min="1900-01-01"
                  max="2100-12-31"
                  onChange={(e) => changeFilter(setTo, e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className="install-history__filter-footer">
        <span>
          {dateError ||
            (loading
              ? "Loading records…"
              : `${total} matching completed job${total === 1 ? "" : "s"}`)}
        </span>
        <button type="button" onClick={clearFilters}>
          <FilterX size={15} /> Clear filters
        </button>
      </div>

      {error && (
        <p role="alert" className="install-history__error">
          {error}
        </p>
      )}
      {loading && !dateError && <p role="status">Loading completed records…</p>}
      {!loading && !error && !dateError && items.length === 0 && (
        <div className="install-history__empty">
          No completed jobs match the selected filters.
        </div>
      )}

      <div className="install-history__grid">
        {!loading &&
          !dateError &&
          !error &&
          items.map((record) => (
            <article className="install-history__card" key={record.id}>
              <div className="install-history__card-top">
                <div>
                  <span
                    className={`install-history__tag is-${record.category?.toLowerCase()}`}
                  >
                    {record.category === "SERVICE" ? "Service" : "Installation"}
                  </span>
                  <h2>{record.reference}</h2>
                  <small>Completed {dateText(record.completedAt)}</small>
                </div>
                <strong className="install-history__amount">
                  {peso(record.amount)}
                </strong>
              </div>
              <div className="install-history__summary">
                <p>
                  <strong>{record.customer || "Customer not recorded"}</strong>
                </p>
                <p>{record.aircon || "Aircon model / capacity not recorded"}</p>
                <small>Team: {record.team || "Not recorded"}</small>
              </div>
              <button
                type="button"
                className="install-history__details-button"
                onClick={() => setSelected(record)}
                aria-label={`View full details for ${record.reference}`}
              >
                View details <ChevronRight size={16} />
              </button>
            </article>
          ))}
      </div>

      {!loading && !dateError && !error && total > 0 && (
        <nav
          className="install-history__pagination"
          aria-label="Completed jobs pages"
        >
          <span>
            Showing {startIndex}–{endIndex} of {total} · Page {page} of{" "}
            {totalPages}
          </span>
          <div>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}

      {selected && <CompletedJobModal record={selected} onClose={closeModal} />}
    </main>
  );
}
