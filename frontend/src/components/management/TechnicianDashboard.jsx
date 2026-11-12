import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PlayCircle,
  RefreshCw,
  Wrench,
} from "lucide-react";

import TechnicianAssignedJobsPanel from "./TechnicianAssignedJobsPanel";
import "../../styles/management/technician-dashboard.css";

const number = (value) => Number(value || 0).toLocaleString("en-PH");

export default function TechnicianDashboard({
  summary = {},
  generatedAt,
  loading,
  error,
  onRefresh,
}) {
  const metrics = [
    {
      label: "Pending services",
      value: summary.pendingServices,
      detail: "Assigned service jobs waiting to start",
      Icon: Wrench,
    },
    {
      label: "Pending order jobs",
      value: summary.pendingOrderJobs,
      detail: "Assigned delivery and installation jobs",
      Icon: ClipboardList,
    },
    {
      label: "In progress",
      value: summary.inProgress,
      detail: "Jobs currently being worked on",
      Icon: PlayCircle,
    },
    {
      label: "Completed",
      value: summary.completed,
      detail: "Your completed jobs",
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className="tech-dashboard">
      <header className="tech-dashboard__header">
        <div>
          <span className="tech-dashboard__eyebrow">
            <Wrench size={16} />
            TECHNICIAN DASHBOARD
          </span>

          <h1>My assigned work</h1>

          <p>
            Only jobs assigned to your technician account appear here. New
            unassigned requests stay with Management.
          </p>
        </div>

        <button
          type="button"
          className="tech-dashboard__refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={17} />
          {loading ? "Updating…" : "Refresh"}
        </button>
      </header>

      {error && (
        <p className="wsm-error" role="alert">
          {error}
        </p>
      )}

      <section className="tech-dashboard__metrics" aria-label="My job totals">
        {metrics.map(({ label, value, detail, Icon }) => (
          <div className="tech-dashboard__metric" key={label}>
            <span className="tech-dashboard__metric-icon">
              <Icon size={21} />
            </span>

            <span className="tech-dashboard__metric-label">{label}</span>

            <strong>{number(value)}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </section>

      <div className="tech-dashboard__context">
        <span>
          <Clock3 size={17} />
          {number(summary.dueToday)} job(s) due today
        </span>

        <span>
          <CalendarDays size={17} />
          {number(summary.awaitingStart)} assigned job(s) not started
        </span>

        <Link to="/management/schedules">View my schedules</Link>
      </div>

      <TechnicianAssignedJobsPanel limit={8} />

      <p className="tech-dashboard__footnote">
        {generatedAt
          ? `Updated ${new Date(generatedAt).toLocaleString("en-PH")}. `
          : ""}
        Assigned jobs refresh while the tab is open. Use Refresh for the latest
        changes.
      </p>
    </div>
  );
}
