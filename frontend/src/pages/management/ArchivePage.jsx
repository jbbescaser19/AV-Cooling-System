import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Filter,
  FolderClosed,
  MessageSquareText,
  Package,
  PackageOpen,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from "lucide-react";
import { readArchive, restoreArchivedRecord } from "../../utils/archiveStore";
import "../../styles/management/archive.css";

const categoryIcons = {
  Products: Package,
  Inventory: Boxes,
  "Service Types": Wrench,
  "Service Requests": ClipboardList,
  "Work Orders": ClipboardList,
  Schedules: CalendarDays,
  Technicians: UserRound,
  Feedback: MessageSquareText,
  "Contact Messages": MessageSquareText,
  "Website Content": FolderClosed,
};

function readableDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isWithinLastWeek(value) {
  const time = new Date(value).getTime();
  const now = Date.now();

  return (
    Number.isFinite(time) &&
    time <= now &&
    time >= now - 7 * 24 * 60 * 60 * 1000
  );
}

function ArchiveRecord({ entry, onRestore, restoring }) {
  const Icon = categoryIcons[entry.category] || Archive;

  return (
    <article className="archive-record">
      <div className="archive-record__top">
        <span className="archive-record__icon">
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="archive-record__title-area">
          <span className="archive-record__group">
            REMOVED FROM {String(entry.category || "OTHER").toUpperCase()}
          </span>

          <h3>{entry.label || entry.recordId || "Unnamed record"}</h3>
        </div>
      </div>

      <div className="archive-record__badges">
        <span className="archive-category-tag">
          {entry.category || "Other"}
        </span>

        <span className="archive-record__id">ID: {entry.recordId || "—"}</span>
      </div>

      <div className="archive-record__facts">
        <div>
          <span>
            <Clock3 size={13} aria-hidden="true" />
            Archived on
          </span>

          <strong>{readableDate(entry.deletedAt)}</strong>
        </div>

        <div>
          <span>
            <UserRound size={13} aria-hidden="true" />
            Archived by
          </span>

          <strong>{entry.deletedBy || "Management staff"}</strong>

          <small>
            {String(entry.deletedByRole || "").replaceAll("_", " ")}
          </small>
        </div>
      </div>

      <button
        className="archive-restore-button"
        type="button"
        disabled={restoring === entry.id}
        onClick={() => onRestore(entry)}
        aria-label={`Restore ${
          entry.label || entry.recordId
        } to ${entry.category}`}
      >
        <ArchiveRestore size={16} aria-hidden="true" />

        {restoring === entry.id ? "Restoring…" : "Restore record"}
      </button>
    </article>
  );
}

export default function ArchivePage() {
  const [entries, setEntries] = useState(readArchive);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    const refresh = () => setEntries(readArchive());

    window.addEventListener("av-management-updated", refresh);

    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("av-management-updated", refresh);

      window.removeEventListener("storage", refresh);
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map();

    for (const entry of entries) {
      const name = entry.category || "Other";
      counts.set(name, (counts.get(name) || 0) + 1);
    }

    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [entries]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return entries
      .filter(
        (entry) =>
          category === "All" || (entry.category || "Other") === category,
      )
      .filter(
        (entry) =>
          !keyword ||
          `${entry.label || ""} ${entry.category || ""} ${
            entry.recordId || ""
          } ${entry.deletedBy || ""}`
            .toLowerCase()
            .includes(keyword),
      )
      .sort((a, b) => {
        const aDate = new Date(a.deletedAt).getTime() || 0;

        const bDate = new Date(b.deletedAt).getTime() || 0;

        return sort === "oldest" ? aDate - bDate : bDate - aDate;
      });
  }, [entries, category, search, sort]);

  const recentCount = entries.filter((entry) =>
    isWithinLastWeek(entry.deletedAt),
  ).length;

  function restore(entry) {
    setError("");
    setNotice("");
    setRestoring(entry.id);

    try {
      restoreArchivedRecord(entry.id);
      setEntries(readArchive());

      setNotice(
        `Restored “${entry.label || entry.recordId}” to ${entry.category}.`,
      );
    } catch (failure) {
      setError(failure.message || "Unable to restore this record.");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="archive-page">
      <header className="archive-hero">
        <div>
          <span className="archive-hero-eyebrow">
            <ShieldCheck size={15} aria-hidden="true" />
            RECORD RECOVERY
          </span>

          <h1>Archive center</h1>

          <p>
            See exactly which management records were removed, where they came
            from, and restore the ones you need.
          </p>
        </div>

        <div className="archive-hero-icon" aria-hidden="true">
          <Archive size={30} />
        </div>
      </header>

      <div className="archive-overview" aria-label="Archive summary">
        <div className="archive-overview-card">
          <span className="archive-overview-icon archive-overview-icon--blue">
            <Archive size={18} aria-hidden="true" />
          </span>

          <span>Total archived</span>
          <strong>{entries.length}</strong>
        </div>

        <div className="archive-overview-card">
          <span className="archive-overview-icon archive-overview-icon--teal">
            <Clock3 size={18} aria-hidden="true" />
          </span>

          <span>Last 7 days</span>
          <strong>{recentCount}</strong>
        </div>

        <div className="archive-overview-card">
          <span className="archive-overview-icon archive-overview-icon--purple">
            <FolderClosed size={18} aria-hidden="true" />
          </span>

          <span>Categories</span>
          <strong>{categoryCounts.length}</strong>
        </div>
      </div>

      <div className="archive-information">
        <ShieldCheck size={18} aria-hidden="true" />

        <p>
          <strong>Recoverable, not permanently erased.</strong> Records are
          hidden from active modules and kept here until restored. This
          prototype stores archive data only in this browser.
        </p>
      </div>

      <section
        className="archive-library"
        aria-labelledby="archive-library-heading"
      >
        <div className="archive-library-head">
          <div>
            <span>RECORD LIBRARY</span>

            <h2 id="archive-library-heading">Archived items</h2>
          </div>

          <span className="archive-count-label">
            {filtered.length} of {entries.length} records
          </span>
        </div>

        <div className="archive-controls">
          <label className="archive-search">
            <Search size={18} aria-hidden="true" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search record name, ID or staff"
              aria-label="Search archived records"
            />
          </label>

          <label className="archive-sort">
            <SlidersHorizontal size={17} aria-hidden="true" />

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort archived records"
            >
              <option value="newest">Newest first</option>

              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        <div
          className="archive-filters"
          role="group"
          aria-label="Filter by category"
        >
          <Filter
            size={16}
            className="archive-filter-icon"
            aria-hidden="true"
          />

          <button
            type="button"
            className={category === "All" ? "active" : ""}
            onClick={() => setCategory("All")}
            aria-pressed={category === "All"}
          >
            All <span>{entries.length}</span>
          </button>

          {categoryCounts.map(([name, count]) => (
            <button
              type="button"
              key={name}
              className={category === name ? "active" : ""}
              onClick={() => setCategory(name)}
              aria-pressed={category === name}
            >
              {name} <span>{count}</span>
            </button>
          ))}
        </div>

        {notice && (
          <p className="archive-message archive-message--success" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            {notice}
          </p>
        )}

        {error && (
          <p className="archive-message archive-message--error" role="alert">
            {error}
          </p>
        )}

        <div className="archive-list">
          {filtered.map((entry) => (
            <ArchiveRecord
              entry={entry}
              key={entry.id}
              onRestore={restore}
              restoring={restoring}
            />
          ))}

          {!filtered.length && (
            <div className="archive-empty">
              <span className="archive-empty-icon">
                <PackageOpen size={27} aria-hidden="true" />
              </span>

              <h3>
                {entries.length
                  ? "No matching records"
                  : "Nothing in Archive yet"}
              </h3>

              <p>
                {entries.length
                  ? "Try a different name, ID, staff member, or category."
                  : "When an owner or manager archives a supported record, it will appear here with its original module label and restore option."}
              </p>

              {entries.length > 0 && (search || category !== "All") && (
                <button
                  type="button"
                  className="archive-clear-button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
