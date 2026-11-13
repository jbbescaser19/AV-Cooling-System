/** Validate Completed Jobs History filters before any database query. */

const PERIODS = new Set(["ALL", "MONTH", "YEAR", "DATE", "RANGE"]);

const CATEGORIES = new Set(["ALL", "INSTALLATION", "SERVICE"]);

const PAGE_SIZE = 16;

function badRequest(message) {
  throw Object.assign(new Error(message), {
    status: 400,
  });
}

function validDay(raw, label) {
  const value = String(raw ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest(`Choose a valid ${label} (YYYY-MM-DD).`);
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    badRequest(`Choose a valid ${label}.`);
  }

  const year = Number(value.slice(0, 4));

  if (year < 1900 || year > 2100) {
    badRequest("Choose a date from 1900 to 2100.");
  }

  return value;
}

function nextDay(value) {
  const day = new Date(`${value}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);

  return day.toISOString().slice(0, 10);
}

export function validateCompletedJobsHistoryQuery(raw = {}) {
  const period = String(raw.period ?? "ALL").toUpperCase();

  const category = String(raw.category ?? "ALL").toUpperCase();

  if (!PERIODS.has(period)) {
    badRequest("Choose a valid date filter.");
  }

  if (!CATEGORIES.has(category)) {
    badRequest("Choose a valid job category.");
  }

  const pageText = String(raw.page ?? "1");

  if (!/^\d+$/.test(pageText)) {
    badRequest("Page number must be a positive integer.");
  }

  const page = Number(pageText);

  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
    badRequest("Choose a valid page number.");
  }

  const search = String(raw.search ?? "").trim();

  if (search.length > 100) {
    badRequest("Search must be 100 characters or fewer.");
  }

  let startDate = null;
  let endExclusiveDate = null;

  if (period === "MONTH") {
    const month = String(raw.month ?? "");

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      badRequest("Choose a valid month.");
    }

    const year = Number(month.slice(0, 4));

    if (year < 1900 || year > 2100) {
      badRequest("Choose a month from 1900 to 2100.");
    }

    startDate = `${month}-01`;

    const following = new Date(`${startDate}T00:00:00Z`);

    following.setUTCMonth(following.getUTCMonth() + 1);

    endExclusiveDate = following.toISOString().slice(0, 10);
  } else if (period === "YEAR") {
    const yearText = String(raw.year ?? "");
    const year = Number(yearText);

    if (!/^\d{4}$/.test(yearText) || year < 1900 || year > 2100) {
      badRequest("Choose a year from 1900 to 2100.");
    }

    startDate = `${yearText}-01-01`;
    endExclusiveDate = `${year + 1}-01-01`;
  } else if (period === "DATE") {
    startDate = validDay(raw.date, "completion date");

    endExclusiveDate = nextDay(startDate);
  } else if (period === "RANGE") {
    const from = String(raw.from ?? "").trim();
    const to = String(raw.to ?? "").trim();

    if (!from && !to) {
      badRequest("Choose at least one date for the range.");
    }

    if (from) {
      startDate = validDay(from, "start date");
    }

    if (to) {
      endExclusiveDate = nextDay(validDay(to, "end date"));
    }

    if (startDate && endExclusiveDate && startDate >= endExclusiveDate) {
      badRequest("The end date must be on or after the start date.");
    }
  }

  return {
    category,
    period,
    search,
    startDate,
    endExclusiveDate,
    page,
    pageSize: PAGE_SIZE,
  };
}
