import connectDB from "../../utils/dbConn.js";

import { dashboardFinancialModel } from "../../models/management/dashboardFinancialModel.js";

import { validateDashboardFinancialRange } from "../../validators/management/dashboardFinancialValidator.js";

const ALLOWED_ROLES = new Set(["OWNER", "MANAGER"]);

function asAmount(value) {
  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function emptyRecord(key) {
  return {
    key,
    productSales: 0,
    serviceRevenue: 0,
    totalRevenue: 0,
    refunds: 0,
    paymentCount: 0,
  };
}

function fillMissingDates(rows, range) {
  const lookup = new Map(
    rows.map((row) => [
      String(row.bucket),
      {
        key: String(row.bucket),
        productSales: asAmount(row.productSales),
        serviceRevenue: asAmount(row.serviceRevenue),
        totalRevenue: asAmount(row.totalRevenue),
        refunds: asAmount(row.refunds),
        paymentCount: Number(row.paymentCount) || 0,
      },
    ]),
  );

  const current = new Date(`${range.startDate}T00:00:00.000Z`);

  const end = new Date(`${range.endDate}T00:00:00.000Z`);

  if (range.groupBy === "month") {
    current.setUTCDate(1);
  }

  const series = [];

  while (current <= end) {
    const key = current
      .toISOString()
      .slice(0, range.groupBy === "month" ? 7 : 10);

    series.push(lookup.get(key) || emptyRecord(key));

    if (range.groupBy === "month") {
      current.setUTCMonth(current.getUTCMonth() + 1);
    } else {
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return series;
}

function calculateTotals(series) {
  const totals = {};

  for (const key of [
    "productSales",
    "serviceRevenue",
    "totalRevenue",
    "refunds",
  ]) {
    const cents = series.reduce(
      (sum, row) => sum + Math.round(row[key] * 100),
      0,
    );

    totals[key] = cents / 100;
  }

  totals.paymentCount = series.reduce((sum, row) => sum + row.paymentCount, 0);

  return totals;
}

export async function getDashboardFinancials(staff, query) {
  if (!ALLOWED_ROLES.has(staff?.role)) {
    throw Object.assign(
      new Error("Financial reports are restricted to Owners and Managers."),
      { status: 403 },
    );
  }

  const range = validateDashboardFinancialRange(query);

  const rows =
    await dashboardFinancialModel(connectDB).getFinancialRecords(range);

  const series = fillMissingDates(rows, range);

  return {
    range,
    totals: calculateTotals(series),
    series,
    generatedAt: new Date().toISOString(),
  };
}
