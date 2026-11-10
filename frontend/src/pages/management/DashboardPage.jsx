import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  LayoutDashboard,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UsersRound,
  Wrench,
} from "lucide-react";

import api from "../../../api/api.js";
import TechnicianDashboard from "../../components/management/TechnicianDashboard";
import "../../styles/management/dashboard-live.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const number = (value) => Number(value || 0).toLocaleString("en-PH");

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

const PAYMENT_PERIODS = {
  daily: { label: "Daily", length: 7, description: "Last 7 calendar days" },
  weekly: {
    label: "Weekly",
    length: 8,
    description: "Last 8 weeks · Monday to Sunday",
  },
  monthly: {
    label: "Monthly",
    length: 6,
    description: "Last 6 calendar months",
  },
  yearly: { label: "Yearly", length: 5, description: "Last 5 calendar years" },
};

const chartDateLabel = (date, options) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", ...options }).format(
    date,
  );

// Anchor chart labels to the dashboard's generated time in Philippine time.
// UTC arithmetic below prevents a browser timezone from shifting bucket keys.
function dashboardDate(generatedAt) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(generatedAt || Date.now()));

  const part = (name) =>
    Number(parts.find((item) => item.type === name)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

function paymentSeries(items, period, generatedAt) {
  const { length } = PAYMENT_PERIODS[period];
  const lookup = new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      String(item.key ?? item.month),
      item,
    ]),
  );
  const today = dashboardDate(generatedAt);

  return Array.from({ length }, (_, index) => {
    const offset = length - 1 - index;
    let date;
    let key;
    let label;
    let title;

    if (period === "daily") {
      date = new Date(today);
      date.setUTCDate(date.getUTCDate() - offset);
      key = date.toISOString().slice(0, 10);
      label = chartDateLabel(date, { month: "short", day: "numeric" });
      title = chartDateLabel(date, { dateStyle: "full" });
    } else if (period === "weekly") {
      date = new Date(today);
      date.setUTCDate(
        date.getUTCDate() - ((date.getUTCDay() + 6) % 7) - offset * 7,
      );
      key = date.toISOString().slice(0, 10);
      label = chartDateLabel(date, { month: "short", day: "numeric" });
      const sunday = new Date(date);
      sunday.setUTCDate(date.getUTCDate() + 6);
      title = `${chartDateLabel(date, { month: "short", day: "numeric", year: "numeric" })} – ${chartDateLabel(sunday, { month: "short", day: "numeric", year: "numeric" })}`;
    } else if (period === "monthly") {
      date = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1),
      );
      key = date.toISOString().slice(0, 7);
      label = chartDateLabel(date, { month: "short" });
      title = chartDateLabel(date, { month: "long", year: "numeric" });
    } else {
      date = new Date(Date.UTC(today.getUTCFullYear() - offset, 0, 1));
      key = String(date.getUTCFullYear());
      label = key;
      title = key;
    }

    const record = lookup.get(key);
    return {
      key,
      label,
      title,
      amount: Number(record?.amount) || 0,
      paymentCount: Number(record?.paymentCount) || 0,
    };
  });
}

function Metric({ icon: Icon, label, value, description, to, tone = "blue" }) {
  return (
    <article className="live-dashboard__metric">
      <div className="live-dashboard__metric-top">
        <span
          className={`live-dashboard__metric-icon live-dashboard__tone-${tone}`}
        >
          <Icon size={20} aria-hidden="true" />
        </span>

        {to && (
          <Link
            to={to}
            aria-label={`Open ${label}`}
            className="live-dashboard__metric-link"
          >
            <ArrowRight size={18} />
          </Link>
        )}
      </div>

      <span className="live-dashboard__metric-label">{label}</span>

      <strong className="live-dashboard__metric-number">{value}</strong>

      <span className="live-dashboard__metric-description">{description}</span>
    </article>
  );
}

function PaymentChart({ trends, monthlyItems, generatedAt }) {
  const [period, setPeriod] = useState("monthly");
  const source = trends?.[period] ?? (period === "monthly" ? monthlyItems : []);
  const series = useMemo(
    () => paymentSeries(source, period, generatedAt),
    [source, period, generatedAt],
  );
  const maximum = Math.max(0, ...series.map((item) => item.amount));
  const sum = series.reduce((total, item) => total + item.amount, 0);
  const count = series.reduce((total, item) => total + item.paymentCount, 0);

  return (
    <section
      className="live-dashboard__panel"
      aria-labelledby="payment-trend-heading"
    >
      <div className="live-dashboard__panel-heading live-dashboard__trend-heading">
        <div>
          <h2 id="payment-trend-heading">Paid payments over time</h2>
          <p>
            {PAYMENT_PERIODS[period].description} · Recorded payments marked
            PAID
          </p>
        </div>

        <div className="live-dashboard__trend-summary">
          <strong className="live-dashboard__panel-emphasis">
            {money(sum)}
          </strong>
          <small>
            {number(count)} paid {count === 1 ? "payment" : "payments"}
          </small>
        </div>
      </div>

      <div
        className="live-dashboard__period-picker"
        role="group"
        aria-label="Paid payment chart period"
      >
        {Object.entries(PAYMENT_PERIODS).map(([key, config]) => (
          <button
            type="button"
            key={key}
            className={period === key ? "is-active" : ""}
            aria-pressed={period === key}
            onClick={() => setPeriod(key)}
          >
            {config.label}
          </button>
        ))}
      </div>

      {maximum === 0 ? (
        <div className="live-dashboard__chart-empty">
          <TrendingUp size={27} aria-hidden="true" />
          <strong>No paid payments in this period</strong>
          <p>
            Choose another period or record a payment as PAID to see it here.
          </p>
        </div>
      ) : (
        <div className="live-dashboard__chart-scroll">
          <div
            className="live-dashboard__chart"
            style={{
              "--paid-chart-columns": series.length,
              "--paid-chart-min-width": `${series.length * 73}px`,
            }}
            role="img"
            aria-label={series
              .map(
                (item) =>
                  `${item.title}: ${money(item.amount)} (${number(item.paymentCount)} payments)`,
              )
              .join(", ")}
          >
            {series.map((item) => (
              <div key={item.key} className="live-dashboard__chart-column">
                <div className="live-dashboard__chart-bar-area">
                  <div
                    className="live-dashboard__chart-bar"
                    style={{
                      height:
                        item.amount === 0
                          ? "0%"
                          : `${Math.max(4, (item.amount / maximum) * 100)}%`,
                    }}
                    title={`${item.title}: ${money(item.amount)} · ${number(item.paymentCount)} paid payments`}
                  />
                </div>
                <span title={item.title}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="live-dashboard__footnote">
        This chart includes PAID payment records only, not uncollected orders,
        pending payments or estimated service revenue. Totals above show the
        selected period.
      </p>
    </section>
  );
}

function StatusBreakdown({ title, summary }) {
  const groups = [
    {
      label: "Pending",
      value: summary.pending,
      color: "#e59a43",
    },
    {
      label: "In progress",
      value: summary.active,
      color: "#308fc2",
    },
    {
      label: "Completed",
      value: summary.completed,
      color: "#20a080",
    },
    {
      label: "Cancelled",
      value: summary.cancelled,
      color: "#98a5b7",
    },
  ];

  return (
    <div className="live-dashboard__breakdown-item">
      <div className="live-dashboard__breakdown-title">
        <strong>{title}</strong>
        <span>{number(summary.total)} total</span>
      </div>

      <div
        className="live-dashboard__breakdown-track"
        role="img"
        aria-label={groups
          .map((group) => `${group.label}: ${group.value}`)
          .join(", ")}
      >
        {groups
          .filter((group) => group.value > 0)
          .map((group) => (
            <span
              key={group.label}
              style={{
                width: `${(group.value / summary.total) * 100}%`,
                backgroundColor: group.color,
              }}
            />
          ))}
      </div>

      <div className="live-dashboard__breakdown-legend">
        {groups.map((group) => (
          <span key={group.label}>
            <i
              style={{
                backgroundColor: group.color,
              }}
            />
            {group.label}
            <b>{number(group.value)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = String(status || "UNKNOWN").toUpperCase();

  const color =
    normalized === "COMPLETED" || normalized === "PAID"
      ? "green"
      : normalized === "PENDING"
        ? "amber"
        : normalized === "CANCELLED" || normalized === "FAILED"
          ? "grey"
          : "blue";

  return (
    <span className={`live-dashboard__status live-dashboard__status-${color}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function RecentRecords({ records }) {
  return (
    <section
      className="live-dashboard__panel"
      aria-labelledby="recent-records-heading"
    >
      <div className="live-dashboard__panel-heading">
        <div>
          <h2 id="recent-records-heading">Recently updated records</h2>
          <p>Latest orders and service requests in MySQL</p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="live-dashboard__simple-empty">
          No orders or service requests yet.
        </div>
      ) : (
        <div className="live-dashboard__records">
          {records.map((record) => {
            const to =
              record.kind === "ORDER"
                ? "/management/orders"
                : "/management/service-requests";

            return (
              <Link
                key={`${record.kind}-${record.id}`}
                to={to}
                className="live-dashboard__record"
              >
                <span
                  className={`live-dashboard__record-symbol ${
                    record.kind === "SERVICE" ? "is-service" : ""
                  }`}
                >
                  {record.kind === "SERVICE" ? (
                    <Wrench size={19} />
                  ) : (
                    <ShoppingBag size={19} />
                  )}
                </span>

                <span className="live-dashboard__record-info">
                  <strong>{record.reference}</strong>

                  <small>
                    {record.title} · {record.detail}
                  </small>
                </span>

                <span className="live-dashboard__record-meta">
                  <StatusPill status={record.status} />

                  <small>{formatDate(record.updatedAt)}</small>
                </span>

                <ArrowRight
                  className="live-dashboard__record-arrow"
                  size={17}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function UpcomingServices({ items }) {
  return (
    <section
      className="live-dashboard__panel"
      aria-labelledby="upcoming-services-heading"
    >
      <div className="live-dashboard__panel-heading">
        <div>
          <h2 id="upcoming-services-heading">Upcoming service requests</h2>

          <p>Preferred schedules · unconfirmed until accepted</p>
        </div>

        <Link
          className="live-dashboard__subtle-link"
          to="/management/service-requests"
        >
          View services <ArrowRight size={16} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="live-dashboard__simple-empty">
          No upcoming pending or confirmed service requests.
        </div>
      ) : (
        <div className="live-dashboard__upcoming-list">
          {items.map((item) => (
            <div key={item.id} className="live-dashboard__upcoming-row">
              <span className="live-dashboard__upcoming-icon">
                <CalendarClock size={18} />
              </span>

              <span className="live-dashboard__upcoming-details">
                <strong>{item.serviceName}</strong>

                <small>
                  {item.customer} · Request #{item.id}
                </small>

                <small>{formatDate(item.preferredStart)}</small>
              </span>

              <StatusPill status={item.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    api
      .get("/api/management/dashboard", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          if (!data.success || !data.dashboard) {
            throw new Error("Dashboard response was invalid.");
          }

          setResult(data);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          if (
            requestError.response?.status === 401 ||
            requestError.response?.status === 403
          ) {
            setResult(null);
          }

          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load dashboard.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setReload((current) => current + 1);
      }
    }, 60000);

    const refresh = () => setReload((current) => current + 1);

    window.addEventListener("av-management-updated", refresh);

    return () => {
      window.clearInterval(interval);

      window.removeEventListener("av-management-updated", refresh);
    };
  }, []);

  const data = result?.dashboard;
  const permissions = data?.permissions || {};

  // Never show company-wide pending requests or forbidden links to technicians.
  if (permissions.technician) {
    return (
      <TechnicianDashboard
        summary={data.technician}
        generatedAt={result?.generatedAt}
        loading={loading}
        error={error}
        onRefresh={() => setReload((current) => current + 1)}
      />
    );
  }

  const metrics = [];

  if (permissions.sales) {
    metrics.push(
      {
        label: "All orders",
        value: number(data.orders.total),
        description: "Online and POS orders",
        icon: ShoppingBag,
        to: "/management/orders",
      },
      {
        label: "Pending orders",
        value: number(data.orders.pending),
        description: "Waiting for action",
        icon: Clock3,
        to: "/management/orders",
        tone: "amber",
      },
      {
        label: "Paid payments",
        value: money(data.payments.paidAmount),
        description: `${number(
          data.payments.paidCount,
        )} recorded paid payments`,
        icon: CreditCard,
        tone: "green",
      },
      {
        label: "Active customers",
        value: number(data.customers.active),
        description: "Active registered accounts",
        icon: UsersRound,
      },
    );
  }

  if (permissions.services) {
    metrics.push(
      {
        label: "Pending services",
        value: number(data.services.pending),
        description: "New requests to review",
        icon: Wrench,
        to: "/management/service-requests",
        tone: "amber",
      },
      {
        label: "Completed services",
        value: number(data.services.completed),
        description: "Service requests completed",
        icon: CheckCircle2,
        to: "/management/service-requests",
        tone: "green",
      },
    );
  }

  if (permissions.inventory) {
    metrics.push({
      label: "Low-stock variants",
      value: number(data.inventory.lowStock),
      description: `${number(
        data.inventory.tracked,
      )} variants tracked in MySQL`,
      icon: PackageCheck,
      tone: data.inventory.lowStock > 0 ? "amber" : "blue",
    });
  }

  const attentionItems = [];

  if (permissions.sales) {
    attentionItems.push({
      label: "Pending orders",
      value: data.orders.pending,
      to: "/management/orders",
    });
  }

  if (permissions.services) {
    attentionItems.push({
      label: "Pending services",
      value: data.services.pending,
      to: "/management/service-requests",
    });
  }

  if (permissions.inventory && data.inventory.tracked > 0) {
    attentionItems.push({
      label: "Low-stock variants",
      value: data.inventory.lowStock,
      to: null,
    });
  }

  const needsAttention = attentionItems.filter((item) => item.value > 0);

  return (
    <div className="live-dashboard">
      <div className="live-dashboard__hero">
        <div className="live-dashboard__hero-content">
          <span className="live-dashboard__eyebrow">
            <LayoutDashboard size={17} />
            MANAGEMENT OVERVIEW
          </span>

          <h1>Business dashboard</h1>

          <p>
            Monitor your actual orders, payments, service requests and
            operations in one place.
          </p>

          <span className="live-dashboard__source">
            <span />
            Connected to MySQL · No sample statistics
          </span>
        </div>

        <div className="live-dashboard__hero-actions">
          <span>
            {result?.generatedAt
              ? `Updated ${formatDate(result.generatedAt)}`
              : "Live business overview"}
          </span>

          <button
            type="button"
            onClick={() => setReload((current) => current + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={loading ? "live-dashboard__spin" : ""}
            />

            {loading ? "Refreshing…" : "Refresh dashboard"}
          </button>
        </div>
      </div>

      {error && (
        <div className="live-dashboard__alert" role="alert">
          <CircleAlert size={19} />

          <span>
            {error}
            {data ? " Showing the last successfully loaded data." : ""}
          </span>

          <button type="button" onClick={() => setReload((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}

      {!data && loading && (
        <div className="live-dashboard__loading" role="status">
          Loading real dashboard data…
        </div>
      )}

      {!data && !loading && !error && (
        <div className="live-dashboard__loading">
          No dashboard data available yet.
        </div>
      )}

      {data && (
        <>
          <section
            aria-label="Business statistics"
            className="live-dashboard__metrics"
          >
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </section>

          <div className="live-dashboard__columns">
            {permissions.sales && (
              <PaymentChart
                trends={data.paymentTrends}
                monthlyItems={data.monthlyPayments}
                generatedAt={result?.generatedAt}
              />
            )}

            <section
              className="live-dashboard__panel"
              aria-labelledby="attention-heading"
            >
              <div className="live-dashboard__panel-heading">
                <div>
                  <h2 id="attention-heading">Needs attention</h2>

                  <p>Items currently waiting for action</p>
                </div>

                <CircleAlert size={20} aria-hidden="true" />
              </div>

              {needsAttention.length ? (
                <div className="live-dashboard__attention-list">
                  {needsAttention.map((item) => (
                    <div
                      key={item.label}
                      className="live-dashboard__attention-item"
                    >
                      <span>{item.label}</span>

                      <strong>{number(item.value)}</strong>

                      {item.to && (
                        <Link to={item.to} aria-label={`Open ${item.label}`}>
                          <ArrowRight size={17} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="live-dashboard__attention-empty">
                  <CheckCircle2 size={26} />

                  <strong>No pending items in the connected records</strong>

                  <span>Refresh the dashboard to check for updates.</span>
                </div>
              )}

              {permissions.sales && (
                <p className="live-dashboard__footnote">
                  Pending order value:{" "}
                  {money(data.orders.awaitingPaymentAmount)}. This is not
                  collected revenue.
                </p>
              )}
            </section>
          </div>

          {(permissions.sales || permissions.services) && (
            <section
              className="live-dashboard__panel"
              aria-labelledby="breakdown-heading"
            >
              <div className="live-dashboard__panel-heading">
                <div>
                  <h2 id="breakdown-heading">Status overview</h2>

                  <p>Current status of every saved record</p>
                </div>
              </div>

              <div className="live-dashboard__breakdowns">
                {permissions.sales && (
                  <StatusBreakdown title="Orders" summary={data.orders} />
                )}

                {permissions.services && (
                  <StatusBreakdown
                    title="Service requests"
                    summary={data.services}
                  />
                )}
              </div>
            </section>
          )}

          <div className="live-dashboard__columns live-dashboard__columns-bottom">
            <RecentRecords records={data.recentRecords} />

            {permissions.services && (
              <UpcomingServices items={data.upcomingServices} />
            )}
          </div>

          <footer className="live-dashboard__footer">
            <TrendingUp size={16} />
            Data updates when you refresh and automatically while this tab is
            open (every 60 seconds). Payment totals use only records marked
            PAID.
          </footer>
        </>
      )}
    </div>
  );
}
