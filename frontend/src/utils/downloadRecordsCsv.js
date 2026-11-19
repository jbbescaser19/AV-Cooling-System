const numericKeys = new Set([
  "available",
  "onHand",
  "reserved",
  "reorderLevel",
  "quantity",
  "price",
  "srp",
  "promoPrice",
  "revenue",
  "orderRevenue",
  "serviceRevenue",
  "startingPrice",
  "paymentAmount",
  "total",
  "amount",
  "horsepower",
  "rating",
]);

export function csvCell(value) {
  if (value == null) return '""';

  const text = String(value);

  // Prevent spreadsheet formula injection.
  const safe =
    typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(text)
      ? "'" + text
      : text;

  return `"${safe.replaceAll('"', '""')}"`;
}

export function recordsCsv(columns, items, format = (value) => value) {
  const rows = [
    columns.map(([, label]) => label),

    ...items.map((item) =>
      columns.map(([key]) => {
        const value = item[key];

        if (value == null) return "";

        if (
          typeof value === "number" ||
          (/^-?\d+(?:\.\d+)?$/.test(String(value)) && numericKeys.has(key))
        ) {
          return Number(value);
        }

        return format(value, key);
      }),
    ),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadRecordsCsv({ columns, items, slug, format }) {
  if (!items.length) return;

  const blob = new Blob(["\uFEFF", recordsCsv(columns, items, format)], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  const name = String(slug).replace(/[^a-z0-9-]/gi, "-");

  link.download = `av-cooling-${name}-${new Date().toISOString().slice(0, 10)}.csv`;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
