export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
// Money is calculated in integer centavos, never floating-point totals.
export function cents(value) {
  const text = String(value);
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(text)) {
    fail("Invalid money amount.");
  }
  const [whole, part = ""] = text.split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}
export function peso(amount) {
  return (amount / 100).toFixed(2);
}
export function validStaff(staff) {
  if (!["OWNER", "MANAGER", "SALES_CASHIER"].includes(staff?.role)) {
    fail("Sales access is required.", 403);
  }
}
