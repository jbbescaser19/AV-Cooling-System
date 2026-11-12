import "../../styles/customer/customer-status.css";

// Shared customer-facing colors for orders, service work and payments.
// Unrecognized values stay neutral instead of being incorrectly shown as successful.
export function getCustomerStatusTone(value) {
  const status = String(value ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (!status) return "neutral";

  if (
    /(?:^|_)(CANCELLED|CANCELED|DECLINED|REJECTED|FAILED|FAILURE|VOID|EXPIRED|REFUNDED)(?:$|_)/.test(
      status,
    )
  )
    return "danger";

  if (
    /(?:^|_)(COMPLETED|COMPLETE|DELIVERED|PAID|SUCCESS|SUCCEEDED)(?:$|_)/.test(
      status,
    ) ||
    status === "PAYMENT_CONFIRMED" ||
    status === "ACTIVE"
  )
    return "success";

  if (
    /(?:^|_)(STARTED|IN_PROGRESS|PROCESSING|ONGOING|PREPARING)(?:$|_)/.test(
      status,
    )
  )
    return "progress";

  if (
    /(?:^|_)(SCHEDULED|RESCHEDULED|SHIPPED|DISPATCHED)(?:$|_)/.test(status) ||
    status === "OUT_FOR_DELIVERY" ||
    status === "ORDER_OUT_FOR_DELIVERY" ||
    status === "SCHEDULE_CHANGED" ||
    status === "AVAILABLE"
  )
    return "scheduled";

  if (/(?:^|_)(CONFIRMED|ACCEPTED|APPROVED|ASSIGNED)(?:$|_)/.test(status))
    return "confirmed";

  if (
    /(?:^|_)(PENDING|UNPAID|AWAITING|VERIFYING|VERIFICATION|HOLD|PROPOSED)(?:$|_)/.test(
      status,
    ) ||
    status === "EXTRA_CHARGES_PROPOSED" ||
    status === "PARTIALLY_PAID"
  )
    return "warning";

  return "neutral";
}

export default function CustomerStatusBadge({
  children,
  status,
  className = "",
}) {
  const value = status ?? children;
  const key =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  const label = children ?? key.replaceAll("_", " ");
  const tone = getCustomerStatusTone(key);

  return (
    <span
      className={["customer-status", `customer-status--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      data-status={key.toUpperCase()}
      data-tone={tone}
    >
      {typeof label === "string" ? label.replaceAll("_", " ") : label}
    </span>
  );
}
