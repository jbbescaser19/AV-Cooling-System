import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/checkout.css";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get(`/api/customer/orders/${encodeURIComponent(orderId)}`, {
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) setOrder(response.data.order);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(
            requestError.response?.data?.message ||
              "Unable to load this order.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderId]);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="surface confirmation-card checkout-confirmation">
          <CheckCircle2 size={42} aria-hidden="true" />
          <h1>Order received</h1>
          {loading && <p role="status">Loading your order...</p>}
          {error && <p role="alert">{error}</p>}
          {order && (
            <>
              <p>
                Order{" "}
                <strong>
                  {order.displayOrderNumber || `Order #${order.orderId}`}
                </strong>{" "}
                is saved in your account.
              </p>
              <p className="muted">
                Status: {order.status} · Payment: {order.paymentStatus}
              </p>
              <div className="checkout-confirmation-lines">
                {order.items.map((item) => (
                  <div key={item.variantId}>
                    <span>
                      {item.qty} × {item.name} {item.hp}
                    </span>
                    <strong>{money(item.lineTotal)}</strong>
                  </div>
                ))}
                <div className="checkout-confirmation-total">
                  <span>Order total (including delivery)</span>
                  <strong>{money(order.total)}</strong>
                </div>
              </div>
              <p className="checkout-small-print">
                Your order is pending store confirmation.{" "}
                {order.paymentCode === "CASH"
                  ? "Cash has not been collected."
                  : `Selected payment: ${order.paymentMethod}. Wait for store confirmation, then visit My Account → Payments for the receiving details and to report your transfer reference. Never share your PIN or OTP. Payment remains PENDING until the store verifies funds.`}
              </p>
            </>
          )}
          <div className="checkout-confirmation-actions">
            <Link className="btn btn-dark" to="/account/orders">
              View my orders
            </Link>
            <Link className="btn btn-soft" to="/account/payments">
              My payments
            </Link>
            <Link className="btn btn-soft" to="/shop">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
