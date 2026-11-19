import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import api from "../../../api/api.js";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const number = (value) =>
  new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const CHART_SERIES = [
  {
    key: "productSales",
    label: "Product Sales",
    color: "#1d4ed8",
    dash: "7 5",
    width: 2.8,
    marker: "square",
  },
  {
    key: "serviceRevenue",
    label: "Service Revenue",
    color: "#b45309",
    dash: "2 5",
    width: 2.8,
    marker: "triangle",
  },
  {
    key: "totalRevenue",
    label: "Total Revenue",
    color: "#a21caf",
    width: 4.5,
    marker: "circle",
  },
];

const DRAW_ORDER = [CHART_SERIES[2], CHART_SERIES[0], CHART_SERIES[1]];

const AMOUNT_KEYS = [
  "productSales",
  "serviceRevenue",
  "totalRevenue",
  "pendingPayments",
];

const SERIES_KEYS = [
  "productSales",
  "serviceRevenue",
  "totalRevenue",
  "refunds",
  "paymentCount",
];

const DAY_MS = 86400000;

const CSS = {
  panel: {
    minWidth: 0,
    border: "1px solid #dce7ee",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
    color: "#183547",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
    alignItems: "center",
  },
  muted: {
    color: "#627d8c",
    fontSize: ".79rem",
  },
  input: {
    minWidth: 0,
    maxWidth: "100%",
    padding: "8px 9px",
    borderRadius: 9,
    border: "1px solid #cddde7",
    background: "#fff",
    color: "#163c54",
  },
  button: {
    padding: "8px 11px",
    border: "1px solid #cddde7",
    borderRadius: 9,
    fontSize: ".8rem",
    fontWeight: 700,
    cursor: "pointer",
    background: "#fff",
    color: "#31596d",
  },
  cell: {
    padding: "10px 12px",
    border: "1px solid #e0ebf1",
    borderRadius: 11,
    minWidth: 0,
    background: "#f9fcfd",
  },
};

function toUTCDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(key, count) {
  const date = toUTCDate(key);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKey(date);
}

function daysBetween(start, end) {
  return Math.round((toUTCDate(end) - toUTCDate(start)) / DAY_MS) + 1;
}

function mondayOf(dateString) {
  const day = toUTCDate(dateString);
  return shiftDays(dateString, -((day.getUTCDay() + 6) % 7));
}

function numeric(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function phToday(timestamp) {
  const parsed = new Date(timestamp || Date.now());
  const valid = Number.isNaN(parsed.valueOf()) ? new Date() : parsed;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(valid);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function presetRange(period, today) {
  const current = toUTCDate(today);

  if (period === "daily") {
    return {
      startDate: shiftDays(today, -6),
      endDate: today,
    };
  }

  if (period === "weekly") {
    return {
      startDate: shiftDays(mondayOf(today), -7 * 7),
      endDate: today,
    };
  }

  if (period === "monthly") {
    return {
      startDate: dateKey(
        new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 5, 1),
        ),
      ),
      endDate: today,
    };
  }

  if (period === "yearly") {
    return {
      startDate: `${current.getUTCFullYear() - 4}-01-01`,
      endDate: today,
    };
  }

  return {
    startDate: shiftDays(today, -29),
    endDate: today,
  };
}

function labelFor(key) {
  if (/^\d{4}$/.test(key)) {
    return key;
  }

  if (/^\d{4}-\d{2}$/.test(key)) {
    const month = toUTCDate(`${key}-01`);

    if (month) {
      return new Intl.DateTimeFormat("en-PH", {
        timeZone: "UTC",
        month: "short",
        year: "numeric",
      }).format(month);
    }
  }

  const day = toUTCDate(key);

  if (day) {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(day);
  }

  return key;
}

/*
 * Choose how the financial data should be displayed.
 *
 * The backend automatically chooses its own date grouping.
 * This frontend combines smaller requests to ensure Weekly
 * and Yearly show the correct periods.
 */
function resolutionFor(period, range) {
  if (period !== "custom") {
    return period;
  }

  const days = daysBetween(range.startDate, range.endDate);

  if (days <= 31) return "daily";
  if (days <= 98) return "weekly";
  if (days <= 1096) return "monthly";

  return "yearly";
}

/*
 * Divide requests into safe date ranges.
 *
 * Daily: Up to 31 days per request.
 * Weekly: Up to 7 days per request.
 * Monthly/Yearly: One calendar year per request.
 *
 * This prevents requests longer than 366 days.
 */
function requestRanges(range, resolution) {
  const segments = [];
  let startDate = range.startDate;

  while (startDate <= range.endDate) {
    let endDate;

    if (resolution === "daily") {
      endDate = shiftDays(startDate, 30);
    } else if (resolution === "weekly") {
      endDate = shiftDays(startDate, 6);
    } else {
      endDate = `${startDate.slice(0, 4)}-12-31`;
    }

    if (endDate > range.endDate) {
      endDate = range.endDate;
    }

    segments.push({
      startDate,
      endDate,
    });

    startDate = shiftDays(endDate, 1);
  }

  return segments;
}

/*
 * Convert returned API dates into the selected chart period.
 */
function bucketKey(raw, resolution) {
  const key = String(raw ?? "");

  if (resolution === "yearly" && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(key)) {
    return key.slice(0, 4);
  }

  if (resolution === "monthly" && /^\d{4}-\d{2}(?:-\d{2})?$/.test(key)) {
    return key.slice(0, 7);
  }

  if (resolution === "weekly" && toUTCDate(key)) {
    return mondayOf(key);
  }

  if (resolution === "daily" && toUTCDate(key)) {
    return key;
  }

  return null;
}

/*
 * Build all periods, including those with zero revenue.
 */
function allPeriodKeys(range, resolution) {
  const keys = [];

  if (resolution === "daily") {
    for (
      let key = range.startDate;
      key <= range.endDate;
      key = shiftDays(key, 1)
    ) {
      keys.push(key);
    }
  } else if (resolution === "weekly") {
    for (
      let key = mondayOf(range.startDate);
      key <= range.endDate;
      key = shiftDays(key, 7)
    ) {
      keys.push(key);
    }
  } else if (resolution === "monthly") {
    let month = toUTCDate(`${range.startDate.slice(0, 7)}-01`);

    while (dateKey(month).slice(0, 7) <= range.endDate.slice(0, 7)) {
      keys.push(dateKey(month).slice(0, 7));

      month = new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1),
      );
    }
  } else {
    for (
      let year = Number(range.startDate.slice(0, 4));
      year <= Number(range.endDate.slice(0, 4));
      year++
    ) {
      keys.push(String(year));
    }
  }

  return keys;
}

/*
 * Combine data from the smaller API requests.
 *
 * Only numeric financial values are added.
 * No new sales or payments are created.
 */
function combineFinancials(responses, range, resolution) {
  const groups = new Map();

  const totals = Object.fromEntries(AMOUNT_KEYS.map((key) => [key, 0]));

  for (const response of responses) {
    const financials = response?.data?.financials;

    if (
      response?.data?.success !== true ||
      !financials ||
      !Array.isArray(financials.series)
    ) {
      throw new Error("The financial API returned an invalid response.");
    }

    for (const key of AMOUNT_KEYS) {
      totals[key] += numeric(financials.totals?.[key]);
    }

    for (const item of financials.series) {
      const key = bucketKey(item.key ?? item.date ?? item.month, resolution);

      if (!key) {
        throw new Error(
          "Unexpected financial date grouping. Please refresh the dashboard.",
        );
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          ...Object.fromEntries(SERIES_KEYS.map((field) => [field, 0])),
        });
      }

      const group = groups.get(key);

      for (const field of SERIES_KEYS) {
        group[field] += numeric(item[field]);
      }
    }
  }

  return {
    totals,
    series: allPeriodKeys(range, resolution).map(
      (key) =>
        groups.get(key) || {
          key,
          ...Object.fromEntries(SERIES_KEYS.map((field) => [field, 0])),
        },
    ),
  };
}

function Mark({ marker, x, y, color, title }) {
  const common = {
    fill: "#fff",
    stroke: color,
    strokeWidth: 2.5,
    vectorEffect: "non-scaling-stroke",
  };

  if (marker === "square") {
    return (
      <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1} {...common}>
        <title>{title}</title>
      </rect>
    );
  }

  if (marker === "triangle") {
    return (
      <path
        d={`M ${x} ${y - 6} L ${x + 5.5} ${y + 4.5} L ${x - 5.5} ${y + 4.5} Z`}
        {...common}
      >
        <title>{title}</title>
      </path>
    );
  }

  return (
    <circle cx={x} cy={y} r={4.5} {...common}>
      <title>{title}</title>
    </circle>
  );
}

function RevenueChart({ series, range }) {
  const id = useId().replaceAll(":", "");

  const width = 860;
  const height = 270;
  const left = 73;
  const right = 20;
  const top = 18;
  const bottom = 52;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const values = series.flatMap((row) =>
    CHART_SERIES.map(({ key }) => row[key]),
  );

  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);

  const span =
    maxValue === minValue
      ? Math.max(1, Math.abs(maxValue))
      : maxValue - minValue;

  const paddedMin = minValue < 0 ? minValue - span * 0.08 : 0;

  const paddedMax = maxValue + span * (maxValue === 0 ? 0.1 : 0.12);

  const y = (value) =>
    top + ((paddedMax - value) / (paddedMax - paddedMin || 1)) * innerHeight;

  const x = (index) =>
    series.length === 1
      ? left + innerWidth / 2
      : left + (index * innerWidth) / (series.length - 1);

  const shownLabels = Math.min(8, series.length);

  const labelIndex = new Set(
    Array.from({ length: shownLabels }, (_, i) =>
      Math.round((i * (series.length - 1)) / Math.max(1, shownLabels - 1)),
    ),
  );

  if (!series.length) {
    return <p style={CSS.muted}>No financial records for this date range.</p>;
  }

  return (
    <div
      style={{
        minWidth: 0,
        width: "100%",
        overflowX: "auto",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Financial line graph from ${range.startDate} to ${range.endDate}`}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          minWidth: 420,
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={`${id}-plot`}>
            <rect
              x={left - 6}
              y={top - 6}
              width={innerWidth + 12}
              height={innerHeight + 12}
            />
          </clipPath>
        </defs>

        {Array.from({ length: 5 }, (_, index) => {
          const value = paddedMin + ((paddedMax - paddedMin) * index) / 4;

          const position = y(value);

          return (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={position}
                y2={position}
                stroke="#e6eff4"
                strokeDasharray="3 5"
              />

              <text
                x={left - 11}
                y={position + 4}
                textAnchor="end"
                fontSize={11}
                fill="#647c8e"
              >
                {number(Math.round(value))}
              </text>
            </g>
          );
        })}

        <g clipPath={`url(#${id}-plot)`}>
          {DRAW_ORDER.map((line) => {
            const positions = series.map((row, index) => ({
              x: x(index),
              y: y(row[line.key]),
              row,
            }));

            const path =
              positions.length === 1
                ? `M ${positions[0].x - 28} ${positions[0].y} L ${positions[0].x + 28} ${positions[0].y}`
                : positions
                    .map(
                      (point, index) =>
                        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                    )
                    .join(" ");

            return (
              <g key={line.key}>
                <path
                  d={path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.width}
                  strokeDasharray={line.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />

                {positions.map((point) => (
                  <Mark
                    key={`${line.key}-${point.row.key}`}
                    marker={line.marker}
                    color={line.color}
                    x={point.x}
                    y={point.y}
                    title={`${line.label} · ${labelFor(point.row.key)}: ${money(point.row[line.key])}`}
                  />
                ))}
              </g>
            );
          })}
        </g>

        {series.map(
          (row, index) =>
            labelIndex.has(index) && (
              <text
                key={row.key}
                x={x(index)}
                y={height - 23}
                textAnchor="middle"
                fill="#587587"
                fontSize={series.length > 14 ? 10 : 11}
              >
                {labelFor(row.key)}
              </text>
            ),
        )}
      </svg>

      {series.length === 1 && (
        <p
          style={{
            ...CSS.muted,
            margin: "2px 0 0",
            textAlign: "center",
          }}
        >
          One period selected: short lines mark the amounts without implying a
          trend.
        </p>
      )}
    </div>
  );
}

export default function DashboardFinancialCharts({ generatedAt }) {
  const today = phToday(generatedAt);

  const initial = useRef(null);

  if (!initial.current) {
    initial.current = presetRange("monthly", today);
  }

  const [period, setPeriod] = useState("monthly");

  const [appliedPeriod, setAppliedPeriod] = useState("monthly");

  const [draftRange, setDraftRange] = useState(initial.current);

  const [appliedRange, setAppliedRange] = useState(initial.current);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const [validationError, setValidationError] = useState("");

  const resolution = useMemo(
    () => resolutionFor(appliedPeriod, appliedRange),
    [appliedPeriod, appliedRange],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setData(null);

    const requests = requestRanges(appliedRange, resolution);

    Promise.all(
      requests.map((dates) =>
        api.get("/api/management/dashboard/financials", {
          params: dates,
          signal: controller.signal,
        }),
      ),
    )
      .then((responses) => {
        if (!controller.signal.aborted) {
          setData(combineFinancials(responses, appliedRange, resolution));
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError?.response?.data?.message ||
              requestError?.message ||
              "Could not load financial records.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [appliedRange, resolution, generatedAt, retry]);

  const series = data?.series || [];
  const totals = data?.totals || {};
  const custom = period === "custom";

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setValidationError("");

    if (nextPeriod === "custom") {
      setDraftRange({ ...appliedRange });
    } else {
      setDraftRange(presetRange(nextPeriod, phToday(generatedAt)));
    }
  }

  function applyFilter(event) {
    event.preventDefault();

    const range = custom
      ? draftRange
      : presetRange(period, phToday(generatedAt));

    const start = toUTCDate(range.startDate);
    const end = toUTCDate(range.endDate);

    if (!start || !end || start > end) {
      setValidationError(
        "Choose valid start and end dates. The start cannot be after the end.",
      );
      return;
    }

    if (range.endDate > phToday(generatedAt)) {
      setValidationError("The end date cannot be in the future.");
      return;
    }

    if (daysBetween(range.startDate, range.endDate) > 3660) {
      setValidationError("Choose a date range of up to 10 years.");
      return;
    }

    setValidationError("");
    setAppliedPeriod(period);
    setAppliedRange({ ...range });

    setRetry((value) => value + 1);
  }

  return (
    <section style={CSS.panel} aria-label="Financial dashboard chart">
      <div
        style={{
          ...CSS.row,
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: "1.06rem",
            }}
          >
            Sales and service revenue
          </h3>

          <p style={{ ...CSS.muted, margin: 0 }}>
            Paid revenue by period · Philippine peso (₱)
          </p>
        </div>

        <button
          type="button"
          style={{
            ...CSS.button,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <form
        onSubmit={applyFilter}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={CSS.row} role="group" aria-label="Financial chart period">
          {["daily", "weekly", "monthly", "yearly", "custom"].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              disabled={loading}
              onClick={() => choosePeriod(option)}
              style={{
                ...CSS.button,
                background: period === option ? "#eaf4ff" : "#fff",
                color: period === option ? "#164ea4" : "#31596d",
                borderColor: period === option ? "#8eb8ed" : "#cddde7",
              }}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        <div style={CSS.row}>
          {custom && (
            <>
              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: ".75rem",
                  fontWeight: 700,
                }}
              >
                Start date
                <input
                  type="date"
                  style={CSS.input}
                  value={draftRange.startDate}
                  max={phToday(generatedAt)}
                  onChange={(event) => {
                    setDraftRange((old) => ({
                      ...old,
                      startDate: event.target.value,
                    }));

                    setValidationError("");
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: ".75rem",
                  fontWeight: 700,
                }}
              >
                End date
                <input
                  type="date"
                  style={CSS.input}
                  value={draftRange.endDate}
                  max={phToday(generatedAt)}
                  onChange={(event) => {
                    setDraftRange((old) => ({
                      ...old,
                      endDate: event.target.value,
                    }));

                    setValidationError("");
                  }}
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...CSS.button,
              background: "#155e88",
              color: "#fff",
              borderColor: "#155e88",
              alignSelf: "end",
            }}
          >
            <CalendarDays
              size={15}
              style={{
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            Apply Filter
          </button>
        </div>

        {validationError && (
          <p
            role="alert"
            style={{
              color: "#a83232",
              margin: 0,
              fontSize: ".79rem",
            }}
          >
            {validationError}
          </p>
        )}
      </form>

      {error && (
        <p
          role="alert"
          style={{
            color: "#a83232",
            margin: "10px 0",
          }}
        >
          {error}
        </p>
      )}

      {loading && (
        <p role="status" style={CSS.muted}>
          Loading financial records…
        </p>
      )}

      {!loading && data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              ["Total Revenue", "totalRevenue"],
              ["Product Sales", "productSales"],
              ["Service Revenue", "serviceRevenue"],
              ["Pending Payments", "pendingPayments"],
            ].map(([label, key]) => (
              <div key={key} style={CSS.cell}>
                <small style={CSS.muted}>{label}</small>

                <strong
                  style={{
                    display: "block",
                    fontSize: "clamp(.88rem, 2vw, 1.15rem)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {money(totals[key])}
                </strong>
              </div>
            ))}
          </div>

          <div
            style={{
              ...CSS.row,
              marginBottom: 4,
              gap: 14,
            }}
          >
            {CHART_SERIES.map((entry) => (
              <span
                key={entry.key}
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: ".77rem",
                  color: "#3a5c6f",
                }}
              >
                <span
                  style={{
                    width: 20,
                    borderTop: `3px ${
                      entry.dash ? "dashed" : "solid"
                    } ${entry.color}`,
                  }}
                  aria-hidden="true"
                />

                {entry.label}
              </span>
            ))}
          </div>

          <RevenueChart series={series} range={appliedRange} />

          <div
            style={{
              ...CSS.row,
              justifyContent: "space-between",
              margin: "10px 0",
            }}
          >
            <small style={CSS.muted}>
              Selected period: {labelFor(appliedRange.startDate)} –{" "}
              {labelFor(appliedRange.endDate)}
            </small>

            <small style={CSS.muted}>
              {series.length} plotted{" "}
              {series.length === 1 ? "period" : "periods"}
            </small>
          </div>

          <div
            style={{
              overflowX: "auto",
              maxWidth: "100%",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 500,
                borderCollapse: "collapse",
                fontSize: ".78rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #d9e8f0",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: "9px 7px",
                    }}
                  >
                    Period
                  </th>

                  <th
                    style={{
                      padding: "9px 7px",
                      textAlign: "right",
                    }}
                  >
                    Product Sales
                  </th>

                  <th
                    style={{
                      padding: "9px 7px",
                      textAlign: "right",
                    }}
                  >
                    Service Revenue
                  </th>

                  <th
                    style={{
                      padding: "9px 7px",
                      textAlign: "right",
                    }}
                  >
                    Total Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {series.length ? (
                  series.map((row) => (
                    <tr
                      key={row.key}
                      style={{
                        borderBottom: "1px solid #ecf2f5",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 7px",
                        }}
                      >
                        {labelFor(row.key)}
                      </td>

                      <td
                        style={{
                          padding: "8px 7px",
                          textAlign: "right",
                        }}
                      >
                        {money(row.productSales)}
                      </td>

                      <td
                        style={{
                          padding: "8px 7px",
                          textAlign: "right",
                        }}
                      >
                        {money(row.serviceRevenue)}
                      </td>

                      <td
                        style={{
                          padding: "8px 7px",
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {money(row.totalRevenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: 12,
                        textAlign: "center",
                      }}
                    >
                      No records for this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
