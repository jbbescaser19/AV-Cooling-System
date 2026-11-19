function fail(message) {
  throw Object.assign(new Error(message), {
    status: 400,
  });
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail("Select a valid date.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 2000 ||
    date.getUTCFullYear() > 2099
  ) {
    fail("Select a valid date between 2000 and 2099.");
  }

  return date;
}

export function validateDashboardFinancialRange(query) {
  const start = parseDate(query.startDate);
  const end = parseDate(query.endDate);

  const days = (end.getTime() - start.getTime()) / 86400000 + 1;

  if (days < 1) {
    fail("The end date must not be before the start date.");
  }

  if (days > 366) {
    fail("Select a date range of up to 366 days.");
  }

  return {
    startDate: query.startDate,
    endDate: query.endDate,
    groupBy: days > 31 ? "month" : "day",
  };
}
