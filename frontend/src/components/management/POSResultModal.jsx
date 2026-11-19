import { useEffect, useRef } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import PayMongoAction from "../payments/PayMongoAction.jsx";
import "../../styles/management/pos-result-modal.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value) || 0,
  );

export default function POSResultModal({
  kind,
  record,
  canManage,
  onClose,
  referenceOnly = false,
  onContinue,
}) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);

  const service = kind === "SERVICE";
  const method = record.paymentMethod || record.method;
  const total = service ? record.price : record.total;
  const code =
    record.reference || record.orderNumber || `Service #${record.id}`;

  return (
    <dialog
      ref={dialog}
      className="av-pos-result"
      aria-labelledby="pos-result-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="av-pos-result__header">
        <CheckCircle2 size={28} aria-hidden="true" />
        <h2 id="pos-result-title">
          {referenceOnly
            ? "Facebook agreement converted"
            : service
              ? "Service booked"
              : "Sale recorded"}
        </h2>
        <p>Transaction successfully saved.</p>
      </header>

      <div className="av-pos-result__reference">
        <span>Transaction reference</span>
        <strong>{code}</strong>
        <button
          type="button"
          className="sales-refresh"
          onClick={() => navigator.clipboard?.writeText(code).catch(() => {})}
        >
          <Copy size={15} /> Copy
        </button>
      </div>

      {referenceOnly ? (
        <footer className="av-pos-result__actions">
          <button type="button" className="sales-refresh" onClick={onClose}>
            Done
          </button>
          <button type="button" className="sales-primary" onClick={onContinue}>
            View {service ? "service request" : "order"}
          </button>
        </footer>
      ) : (
        <>
          <dl className="av-pos-result__facts">
            <div>
              <dt>Customer</dt>
              <dd>{record.customer}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                {record.paymentStatus} · {method || "—"}
              </dd>
            </div>
            {(record.appointment || record.scheduledStart) && (
              <div>
                <dt>Appointment</dt>
                <dd>
                  {String(record.appointment || record.scheduledStart).replace(
                    "T",
                    " at ",
                  )}{" "}
                  (PH time)
                </dd>
              </div>
            )}
            {service && (
              <div>
                <dt>Service</dt>
                <dd>{record.service}</dd>
              </div>
            )}
          </dl>

          {record.items?.map((item) => (
            <div className="sales-totals" key={item.variantId}>
              <span>
                {item.quantity} × {item.productName} · {item.horsepower} HP
              </span>
              <strong>{money(item.lineTotal)}</strong>
            </div>
          ))}

          {(record.subtotal ?? record.basePrice) != null && (
            <div className="sales-totals">
              <span>Subtotal</span>
              <strong>{money(record.subtotal ?? record.basePrice)}</strong>
            </div>
          )}

          {Number(record.discount) > 0 && (
            <>
              <div className="sales-totals">
                <span>Discount</span>
                <strong>−{money(record.discount)}</strong>
              </div>
              <p className="sales-note">
                Reason: {record.discountReason || "Not recorded"}
              </p>
            </>
          )}

          {Number(record.additionalFee) > 0 && (
            <>
              <div className="sales-totals">
                <span>Additional fee</span>
                <strong>{money(record.additionalFee)}</strong>
              </div>
              <p className="sales-note">Reason: {record.additionalFeeReason}</p>
            </>
          )}

          {record.deliveryFee != null && (
            <div className="sales-totals">
              <span>Delivery fee</span>
              <strong>{money(record.deliveryFee)}</strong>
            </div>
          )}

          <div className="sales-totals sales-total">
            <strong>
              {record.paymentStatus === "PAID" ? "Total paid" : "Amount due"}
            </strong>
            <strong>{money(total)}</strong>
          </div>

          {record.cashReceived != null && (
            <>
              <div className="sales-totals">
                <span>Cash received</span>
                <strong>{money(record.cashReceived)}</strong>
              </div>
              <div className="sales-totals">
                <span>Change</span>
                <strong>{money(record.change)}</strong>
              </div>
            </>
          )}

          {record.paymentStatus === "PENDING" &&
            ["GCASH", "BANK_TRANSFER"].includes(method) &&
            record.paymentId && (
              <PayMongoAction kind={kind} identifier={record.paymentId} staff />
            )}

          {record.paymentStatus === "PENDING" && method === "CASH" && (
            <p className="sales-note">
              Cash is not yet collected. Authorized staff can confirm payment
              later.
            </p>
          )}

          <footer className="av-pos-result__actions">
            {canManage && (
              <Link
                className="sales-refresh"
                to={
                  service
                    ? `/management/service-requests?requestId=${record.id}`
                    : "/management/orders"
                }
              >
                View {service ? "service" : "orders"}
              </Link>
            )}
            <button type="button" className="sales-primary" onClick={onClose}>
              Done
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
