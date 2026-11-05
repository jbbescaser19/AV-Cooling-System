import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarDays,
  ClipboardList,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  orders as seedOrders,
  notifications as seedNotifications,
  serviceRequests as seedServices,
  customers as seedCustomers,
} from "../../data/mockManagement";

import {
  getPosOrders,
  getStoredNotifications,
} from "../../utils/managementStore";

import { loadMock } from "../../utils/prototypeStore";
import { readCatalogProducts } from "../../utils/catalogStore";

import {
  canManageArchive,
  readArchive,
  readArchivedInventoryKeys,
} from "../../utils/archiveStore";

import "../../styles/management/dashboard.css";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  })}`;

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (/(complete|delivered|paid|picked up)/.test(value)) {
    return "success";
  }

  if (/(pending|processing)/.test(value)) {
    return "warning";
  }

  return "info";
}

function statusGroup(status) {
  const value = String(status || "").toLowerCase();

  if (/(complete|delivered|picked up)/.test(value)) {
    return "Completed";
  }

  if (/(cancel|failed|rejected|refunded)/.test(value)) {
    return "Cancelled / failed";
  }

  if (/(pending|awaiting)/.test(value)) {
    return "Pending";
  }

  return "In progress";
}

function orderDate(value) {
  if (!value) return null;

  const normalized = String(value).replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/,
    "$1T$2",
  );

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function monthlyOrderValues(orders) {
  const today = new Date();

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - (5 - index),
      1,
    );

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}`,
      label: date.toLocaleDateString("en-PH", {
        month: "short",
      }),
      total: 0,
      count: 0,
    };
  });

  for (const order of orders) {
    const date = orderDate(order.createdAt);

    if (!date) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}`;

    const month = months.find((item) => item.key === key);

    if (!month) continue;

    month.total += Math.max(0, Number(order.total) || 0);
    month.count += 1;
  }

  return months;
}

function smoothLine(points) {
  if (!points.length) return "";

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const midpoint = (a.x + b.x) / 2;

    path += ` C ${midpoint} ${a.y}, ${midpoint} ${b.y}, ${b.x} ${b.y}`;
  }

  return path;
}

function OrderTrendChart({ months }) {
  const maximum = Math.max(0, ...months.map((month) => month.total));

  const total = months.reduce((sum, month) => sum + month.total, 0);

  const count = months.reduce((sum, month) => sum + month.count, 0);

  if (!maximum) {
    return (
      <div className="dashboard-chart-empty dashboard-chart-empty--trend">
        <TrendingUp size={24} aria-hidden="true" />
        <strong>No order trend yet</strong>
        <span>Dated orders from the last six months will appear here.</span>
      </div>
    );
  }

  const width = 680;
  const baseline = 192;
  const top = 24;
  const left = 18;
  const right = 660;
  const chartHeight = baseline - top;

  const points = months.map((month, index) => ({
    ...month,
    x: left + ((right - left) * index) / Math.max(1, months.length - 1),
    y: baseline - (month.total / maximum) * (chartHeight - 15),
  }));

  const linePath = smoothLine(points);

  const areaPath = `${linePath} L ${
    points[points.length - 1].x
  } ${baseline} L ${points[0].x} ${baseline} Z`;

  return (
    <div className="dashboard-trend">
      <div className="dashboard-trend-summary">
        <div>
          <span>Total order value</span>
          <strong>{money(total)}</strong>
        </div>

        <span className="dashboard-trend-orders">
          <ShoppingCart size={14} aria-hidden="true" />
          {count} orders
        </span>
      </div>

      <div
        className="dashboard-line-chart"
        role="img"
        aria-label={`Monthly order value: ${months
          .map((item) => `${item.label} ${money(item.total)}`)
          .join(", ")}`}
      >
        <svg viewBox={`0 0 ${width} 218`} preserveAspectRatio="none">
          <defs>
            <linearGradient
              id="dashboard-trend-area"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#19a8d0" stopOpacity=".27" />
              <stop offset="100%" stopColor="#19a8d0" stopOpacity=".012" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              className="dashboard-gridline"
              x1="0"
              x2={width}
              y1={baseline - (chartHeight - 15) * ratio}
              y2={baseline - (chartHeight - 15) * ratio}
            />
          ))}

          <path d={areaPath} fill="url(#dashboard-trend-area)" />

          <path className="dashboard-line-path" d={linePath} />

          {points.map((point) => (
            <g key={point.key}>
              <circle
                className="dashboard-line-halo"
                cx={point.x}
                cy={point.y}
                r="9"
              />

              <circle
                className="dashboard-line-point"
                cx={point.x}
                cy={point.y}
                r="4.5"
              >
                <title>
                  {`${point.label}: ${money(
                    point.total,
                  )} (${point.count} orders)`}
                </title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      <div className="dashboard-line-labels" aria-hidden="true">
        {months.map((month) => (
          <span key={month.key}>{month.label}</span>
        ))}
      </div>

      <p className="dashboard-chart-caption">
        Order totals from dated sample and saved orders. This is not a verified
        payments report.
      </p>
    </div>
  );
}

function BreakdownDonut({
  data,
  centerLabel,
  centerValue,
  ariaLabel,
  stock = false,
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const circumference = 2 * Math.PI * 44;

  let offset = 0;

  const segments = data.map((item) => {
    const length = total ? (item.value / total) * circumference : 0;

    const segment = {
      ...item,
      length,
      offset,
    };

    offset += length;

    return segment;
  });

  return (
    <div className="dashboard-breakdown">
      <div className="dashboard-donut-graphic">
        <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
          <circle className="dashboard-donut-track" cx="60" cy="60" r="44" />

          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <circle
                key={segment.label}
                className="dashboard-donut-segment"
                cx="60"
                cy="60"
                r="44"
                stroke={segment.color}
                strokeDasharray={`${Math.max(
                  0,
                  segment.length - (total > 1 ? 3 : 0),
                )} ${circumference}`}
                strokeDashoffset={-segment.offset}
              >
                <title>
                  {segment.label}: {segment.value}
                </title>
              </circle>
            ))}
        </svg>

        <div className="dashboard-donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>

      <div className="dashboard-chart-legend">
        {data.map((item) => (
          <div key={item.label} className="dashboard-legend-row">
            <span
              className="dashboard-legend-dot"
              style={{ background: item.color }}
            />

            <span>{item.label}</span>
            <strong>{item.value}</strong>

            <small>
              {total ? `${Math.round((item.value / total) * 100)}%` : "0%"}
            </small>
          </div>
        ))}

        {stock && (
          <p className="dashboard-legend-note">
            Based on this browser's prototype inventory quantities.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [, setRefreshNumber] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setRefreshNumber((number) => number + 1);
    };

    window.addEventListener("av-management-updated", refresh);

    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("av-management-updated", refresh);

      window.removeEventListener("storage", refresh);
    };
  }, []);

  const posOrders = getPosOrders();

  const orders = loadMock("av_managed_orders", seedOrders);

  const allOrders = [...posOrders, ...orders];

  const services = loadMock("av_module_service-requests", seedServices);

  const notifications = getStoredNotifications(seedNotifications);

  const customers = loadMock("av_customers", seedCustomers);

  const archivedInventory = new Set(readArchivedInventoryKeys());

  const savedStock = loadMock("av_inventory_stock", {});

  const variants = readCatalogProducts().flatMap((product) =>
    (product.variants || []).map((variant) => ({
      key: `${product.id}:${variant.hp}`,
    })),
  );

  const quantities = variants
    .map(({ key }, index) => ({
      key,
      quantity: Number(
        savedStock[key] ?? (index % 7 === 0 ? 2 : 8 + (index % 5)),
      ),
    }))
    .filter(({ key }) => !archivedInventory.has(key))
    .map(({ quantity }) => quantity);

  const stockHealth = [
    {
      label: "Low (0–2)",
      value: quantities.filter((quantity) => quantity <= 2).length,
      color: "#e36e74",
    },
    {
      label: "Reorder (3–5)",
      value: quantities.filter((quantity) => quantity > 2 && quantity <= 5)
        .length,
      color: "#eeb65a",
    },
    {
      label: "Healthy (6+)",
      value: quantities.filter((quantity) => quantity > 5).length,
      color: "#13a98c",
    },
  ];

  const lowStockCount = stockHealth[0].value;

  const monthlyValues = monthlyOrderValues(allOrders);

  const statusData = [
    {
      label: "Completed",
      value: allOrders.filter(
        (order) => statusGroup(order.status) === "Completed",
      ).length,
      color: "#16aa91",
    },
    {
      label: "In progress",
      value: allOrders.filter(
        (order) => statusGroup(order.status) === "In progress",
      ).length,
      color: "#3795dd",
    },
    {
      label: "Pending",
      value: allOrders.filter(
        (order) => statusGroup(order.status) === "Pending",
      ).length,
      color: "#f0b45c",
    },
    {
      label: "Cancelled",
      value: allOrders.filter(
        (order) => statusGroup(order.status) === "Cancelled / failed",
      ).length,
      color: "#e36e74",
    },
  ];

  const walkInSales = posOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );

  const unread = notifications.filter((item) => !item.read).length;

  const pendingServices = services.filter(
    (service) => !/(completed|rejected)/i.test(String(service.status)),
  ).length;

  const archiveCount = readArchive().length;

  const stats = [
    {
      icon: ShoppingCart,
      label: "Orders",
      value: allOrders.length,
      path: "/management/orders",
      tone: "blue",
    },
    {
      icon: Banknote,
      label: "Walk-in POS sales",
      value: money(walkInSales),
      path: "/management/pos",
      tone: "teal",
    },
    {
      icon: Package,
      label: "Low stock",
      value: lowStockCount,
      path: "/management/inventory",
      tone: "coral",
    },
    {
      icon: CalendarDays,
      label: "Pending services",
      value: pendingServices,
      path: "/management/service-requests",
      tone: "amber",
    },
    {
      icon: Users,
      label: "Customers",
      value: customers.length,
      path: "/management/customers",
      tone: "indigo",
    },
    {
      icon: Bell,
      label: "Unread alerts",
      value: unread,
      path: "/management/notifications",
      tone: "purple",
    },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-hero">
        <div className="dashboard-hero-content">
          <span className="dashboard-hero-eyebrow">
            <Activity size={15} aria-hidden="true" />
            OPERATIONS OVERVIEW
          </span>

          <h1>Management dashboard</h1>

          <p>
            A clearer view of orders, sales activity, inventory, and the work
            that needs attention.
          </p>

          <span className="dashboard-prototype-note">
            Browser-based prototype data · Not a live financial report
          </span>
        </div>

        {canManageArchive() && (
          <button
            type="button"
            className="dashboard-archive-link"
            onClick={() => navigate("/management/archive")}
          >
            <Archive size={17} aria-hidden="true" />
            View archive
            <span>{archiveCount}</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )}

        <div className="dashboard-hero-decoration" aria-hidden="true" />
      </header>

      <section
        className="dashboard-section"
        aria-labelledby="dashboard-highlights"
      >
        <div className="dashboard-section-heading">
          <div>
            <span>YOUR BUSINESS AT A GLANCE</span>
            <h2 id="dashboard-highlights">Key metrics</h2>
          </div>

          <small>Tap a card to open its module</small>
        </div>

        <div className="metric-grid metric-grid-six dashboard-metrics">
          {stats.map(({ icon: Icon, label, value, path, tone }) => (
            <button
              type="button"
              className={`metric-card metric-card-button dashboard-metric dashboard-metric--${tone}`}
              key={label}
              onClick={() => navigate(path)}
            >
              <span className="dashboard-metric-icon">
                <Icon size={20} aria-hidden="true" />
              </span>

              <span className="dashboard-metric-label">{label}</span>

              <strong className="dashboard-metric-value">{value}</strong>

              <ArrowUpRight
                className="dashboard-metric-arrow"
                size={16}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </section>

      <section
        className="dashboard-section"
        aria-labelledby="dashboard-analytics"
      >
        <div className="dashboard-section-heading">
          <div>
            <span>INSIGHTS & TRENDS</span>
            <h2 id="dashboard-analytics">Business analytics</h2>
          </div>

          <small>Updated from locally saved records</small>
        </div>

        <div className="dashboard-chart-grid">
          <section className="mgmt-panel dashboard-chart-card dashboard-chart-card--wide">
            <div className="mgmt-panel-header">
              <div>
                <span className="dashboard-chart-eyebrow">SALES ACTIVITY</span>
                <h3>Order value trend</h3>
              </div>

              <span className="dashboard-chart-period">Last 6 months</span>
            </div>

            <OrderTrendChart months={monthlyValues} />
          </section>

          <section className="mgmt-panel dashboard-chart-card">
            <div className="mgmt-panel-header">
              <div>
                <span className="dashboard-chart-eyebrow">FULFILLMENT</span>
                <h3>Order status</h3>
              </div>
            </div>

            <BreakdownDonut
              data={statusData}
              centerValue={allOrders.length}
              centerLabel="orders"
              ariaLabel={`Orders by status: ${statusData
                .map((item) => `${item.label} ${item.value}`)
                .join(", ")}`}
            />
          </section>

          <section className="mgmt-panel dashboard-chart-card">
            <div className="mgmt-panel-header">
              <div>
                <span className="dashboard-chart-eyebrow">
                  INVENTORY HEALTH
                </span>
                <h3>Stock overview</h3>
              </div>
            </div>

            <BreakdownDonut
              data={stockHealth}
              centerValue={quantities.length}
              centerLabel="variants"
              ariaLabel={`Inventory variants by stock level: ${stockHealth
                .map((item) => `${item.label} ${item.value}`)
                .join(", ")}`}
              stock
            />

            <button
              type="button"
              className="dashboard-chart-action"
              onClick={() => navigate("/management/inventory")}
            >
              Review inventory
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </section>
        </div>
      </section>

      <section
        className="dashboard-section"
        aria-labelledby="dashboard-operations"
      >
        <div className="dashboard-section-heading">
          <div>
            <span>DAILY OPERATIONS</span>
            <h2 id="dashboard-operations">Latest activity</h2>
          </div>
        </div>

        <div className="dashboard-panels">
          <section className="mgmt-panel dashboard-orders-panel">
            <div className="mgmt-panel-header">
              <div>
                <span className="dashboard-chart-eyebrow">TRANSACTIONS</span>
                <h3>Recent orders</h3>
              </div>

              <button
                type="button"
                className="dashboard-text-link"
                onClick={() => navigate("/management/orders")}
              >
                View all
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {allOrders.slice(0, 6).map((order) => (
                    <tr key={order.id}>
                      <td data-label="Order">
                        <span className="table-primary">{order.id}</span>
                      </td>

                      <td data-label="Customer">{order.customer}</td>

                      <td data-label="Source">{order.source || "Online"}</td>

                      <td data-label="Status">
                        <span
                          className={`status-pill ${statusClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td data-label="Total">
                        <strong>{money(order.total)}</strong>
                      </td>
                    </tr>
                  ))}

                  {!allOrders.length && (
                    <tr>
                      <td colSpan={5}>No orders yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mgmt-panel dashboard-alert-panel">
            <div className="mgmt-panel-header">
              <div>
                <span className="dashboard-chart-eyebrow">FOLLOW-UP</span>
                <h3>Needs attention</h3>
              </div>

              <button
                type="button"
                className="dashboard-text-link"
                onClick={() => navigate("/management/notifications")}
              >
                {unread} unread
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="dashboard-alert-list">
              {notifications
                .filter((item) => !item.read)
                .slice(0, 5)
                .map((item) => (
                  <article key={item.id}>
                    <div
                      className={`alert-dot ${
                        item.priority === "High" ? "high" : ""
                      }`}
                    />

                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <small>{item.time}</small>
                    </div>
                  </article>
                ))}

              {!unread && (
                <div className="dashboard-chart-empty">
                  <ClipboardList size={23} aria-hidden="true" />
                  <strong>All caught up</strong>
                  <span>No unread alerts.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
