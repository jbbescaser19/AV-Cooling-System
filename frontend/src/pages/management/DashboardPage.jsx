import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardFinancialCharts from "../../components/management/DashboardFinancialCharts.jsx";
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
  MessageSquareText,
} from "lucide-react";

import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
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

function PaymentChart({ generatedAt }) {
  return <DashboardFinancialCharts generatedAt={generatedAt} />;
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

function FeedbackSentiment({ summary }) {
  if (!summary) return null;
  const analyzed = summary.positive + summary.neutral + summary.negative;
  const groups = [
    { key: "positive", label: "Positive", color: "positive" },
    { key: "neutral", label: "Neutral", color: "neutral" },
    { key: "negative", label: "Negative", color: "negative" },
  ];
  return (
    <section
      className="live-dashboard__panel sentiment-overview"
      aria-labelledby="sentiment-heading"
    >
      <div className="live-dashboard__panel-heading">
        <div>
          <h2 id="sentiment-heading">
            <MessageSquareText size={20} aria-hidden="true" /> Customer feedback
            sentiment
          </h2>
          <p>
            Real submitted feedback classified as positive, neutral, or negative
          </p>
        </div>
        <Link className="live-dashboard__subtle-link" to="/management/feedback">
          Manage feedback <ArrowRight size={16} />
        </Link>
      </div>
      {summary.total === 0 ? (
        <div className="live-dashboard__simple-empty">
          No customer feedback has been submitted yet. Sentiment figures will
          appear here when feedback is received.
        </div>
      ) : (
        <>
          <div className="sentiment-overview__stats">
            <div>
              <strong>{number(summary.total)}</strong>
              <span>Total feedback</span>
            </div>
            <div>
              <strong>{number(analyzed)}</strong>
              <span>Analyzed</span>
            </div>
            <div>
              <strong>{number(summary.unanalyzed)}</strong>
              <span>Awaiting analysis</span>
            </div>
          </div>
          <div className="sentiment-overview__bars">
            {groups.map((group) => {
              const count = Number(summary[group.key] || 0);
              const percent = analyzed
                ? Math.round((count / analyzed) * 100)
                : 0;
              return (
                <div className="sentiment-overview__row" key={group.key}>
                  <div className="sentiment-overview__label">
                    <strong>{group.label}</strong>
                    <span>
                      {number(count)} · {percent}%
                    </span>
                  </div>
                  <div
                    className="sentiment-overview__track"
                    role="img"
                    aria-label={`${group.label}: ${count} feedback items, ${percent} percent of analyzed feedback`}
                  >
                    <span
                      className={`sentiment-overview__bar is-${group.color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="sentiment-overview__note">
            Percentages use analyzed feedback only. Unanalyzed submissions are
            shown separately; sentiment is an automated estimate, not a review
            of service quality.
          </p>
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const hasLoadedRef = useRef(false);

  useRealtimeRefresh(
    [
      "dashboard",
      "orders",
      "services",
      "payments",
      "inventory",
      "reports",
      "feedback",
      "jobs",
    ],
    setReload,
  );

  useEffect(() => {
    const controller = new AbortController();

    if (!hasLoadedRef.current) {
      setLoading(true);
    }

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

          hasLoadedRef.current = true;

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
    const refresh = () => setReload((current) => current + 1);

    window.addEventListener("av-management-updated", refresh);

    return () => window.removeEventListener("av-management-updated", refresh);
  }, []);

  const data = result?.dashboard;

  const permissions = data?.permissions || {};

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

  const financials = permissions.financials ? data?.financials : null;

  const metrics = [];

  // Financial cards for Owner and Manager.
  if (financials) {
    metrics.push(
      {
        label: "Total Revenue",

        value: money(financials.totalRevenue),

        description: "All collected payments after refunds",

        icon: TrendingUp,

        tone: "green",
      },

      {
        label: "Product Sales",

        value: money(financials.productSales),

        description: "Collected order payments after refunds",

        icon: ShoppingBag,

        tone: "blue",
      },

      {
        label: "Service Revenue",

        value: money(financials.serviceRevenue),

        description: "Collected service payments after refunds",

        icon: Wrench,

        tone: "blue",
      },

      {
        label: "Pending Payments",

        value: money(financials.pendingPayments),

        description: "Uncollected orders and service payments",

        icon: CreditCard,

        tone: "amber",
      },
    );
  }

  if (permissions.sales) {
    metrics.push(
      {
        label: "All orders",

        value: number(data.orders.total),

        description: "Online, POS and Facebook orders",

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
    );

    // Preserve the existing cashier payment metric.
    // Avoid duplicating Total Revenue for Owner and Manager.
    if (!financials) {
      metrics.push({
        label: "Paid payments",

        value: money(data.payments.paidAmount),

        description: `${number(
          data.payments.paidCount,
        )} recorded paid payments`,

        icon: CreditCard,

        tone: "green",
      });
    }

    metrics.push({
      label: "Active customers",

      value: number(data.customers.active),

      description: "Active registered accounts",

      icon: UsersRound,
    });
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

          <button
            type="button"
            onClick={() => setReload((current) => current + 1)}
          >
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

              {financials ? (
                <p className="live-dashboard__footnote">
                  Pending order payments: {money(financials.pendingOrders)}.{" "}
                  Pending service payments: {money(financials.pendingServices)}.{" "}
                  These are not collected revenue.
                </p>
              ) : (
                permissions.sales && (
                  <p className="live-dashboard__footnote">
                    Pending order value:{" "}
                    {money(data.orders.awaitingPaymentAmount)}. This is not
                    collected revenue.
                  </p>
                )
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

          {data.feedbackSentiment && (
            <FeedbackSentiment summary={data.feedbackSentiment} />
          )}

          <div className="live-dashboard__columns live-dashboard__columns-bottom">
            <RecentRecords records={data.recentRecords} />

            {permissions.services && (
              <UpcomingServices items={data.upcomingServices} />
            )}
          </div>

          <footer className="live-dashboard__footer">
            <TrendingUp size={16} />
            Data updates after recorded business changes or when you use
            Refresh. Revenue excludes pending payments and deducts recorded
            refunds.
          </footer>
        </>
      )}
    </div>
  );
}
