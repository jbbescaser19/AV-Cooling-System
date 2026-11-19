import { useState } from "react";
import "../../styles/common/record-category-filters.css";

const valuesFor = (field, row) => {
  const raw = field.read(row);
  return (Array.isArray(raw) ? raw : [raw])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
};

export function hpLabel(value) {
  const text = String(value ?? "").trim();
  const number = Number(text.replace(/\s*HP$/i, ""));
  return text && Number.isFinite(number) && number > 0 ? number + " HP" : "";
}

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"];
const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

function standardOptions(item) {
  if (item.key === "paymentStatus" || item.label === "Payment statuses")
    return PAYMENT_STATUSES;
  if (
    item.key === "orderStatus" ||
    (item.key === "status" && item.label === "Statuses")
  )
    return ORDER_STATUSES;
  if (item.key === "channel" && item.label === "Channels")
    return ["ONLINE", "POS", "FACEBOOK", "SERVICE"];
  if (item.key === "method" && item.label === "Payment methods")
    return ["CASH", "GCASH", "BANK_TRANSFER"];
  if (item.key === "kind" && item.label === "Record types")
    return ["ORDER", "SERVICE"];
  if (item.key === "fulfillment") return ["DELIVERY", "PICKUP"];
  if (item.key === "read" && item.label === "Read statuses")
    return ["Read", "Unread"];
  if (item.key === "requestKind") return ["AIRCON", "SERVICE"];
  if (item.key === "role" && item.label === "Roles")
    return ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"];
  return [];
}

export function filterOptions(item, rows) {
  const defaults = standardOptions(item);
  const observed = [
    ...new Set(rows.flatMap((row) => valuesFor(item, row))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return [...new Set([...defaults, ...observed])];
}

export function field(
  key,
  label,
  read = (row) => row[key],
  format = (value) => value.replaceAll("_", " "),
) {
  return { key, label, read, format };
}

export function useRecordFilters(rows, fields, scope = "") {
  const [state, setState] = useState({ scope, values: {} });
  const values = state.scope === scope ? state.values : {};
  const controls = fields.map((item) => ({
    ...item,
    options: filterOptions(item, rows),
    value: values[item.key] || "",
  }));
  const filtered = rows.filter((row) =>
    controls.every(
      (item) => !item.value || valuesFor(item, row).includes(item.value),
    ),
  );
  return {
    filtered,
    controls,
    change(key, value) {
      setState((previous) => ({
        scope,
        values: {
          ...(previous.scope === scope ? previous.values : {}),
          [key]: value,
        },
      }));
    },
    reset() {
      setState({ scope, values: {} });
    },
  };
}

export default function RecordCategoryFilters({ filters, onChange }) {
  const controls = filters.controls.filter(
    (item) => item.options.length > 0 || item.value,
  );
  if (!controls.length) return null;
  return (
    <div
      className="av-category-filters"
      role="group"
      aria-label="Filter records"
    >
      {controls.map((item) => (
        <label key={item.key}>
          <span>{item.label}</span>
          <select
            value={item.value}
            onChange={(event) => {
              filters.change(item.key, event.target.value);
              onChange?.();
            }}
          >
            <option value="">All {item.label.toLowerCase()}</option>
            {item.value && !item.options.includes(item.value) && (
              <option value={item.value}>
                {item.format(item.value)} (no matches)
              </option>
            )}
            {item.options.map((value) => (
              <option key={value} value={value}>
                {item.format(value)}
              </option>
            ))}
          </select>
        </label>
      ))}
      {controls.some((item) => item.value) && (
        <button
          type="button"
          onClick={() => {
            filters.reset();
            onChange?.();
          }}
        >
          Reset categories
        </button>
      )}
    </div>
  );
}
