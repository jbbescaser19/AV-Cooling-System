import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import api from "../../../api/api.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import { formatCustomerMoney } from "../../utils/customerAccountUtils";

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get("/api/customer/orders", { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setOrders(response.data.orders || []);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(
            requestError.response?.data?.message ||
              "Unable to load payment records.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={CreditCard}
        title="Payments"
        copy="Payment status of your real MySQL orders."
      />
      {loading && <p role="status">Loading payments...</p>}
      {error && (
        <div className="surface customer-record" role="alert">
          <span>{error}</span>
          <button
            className="btn btn-soft"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && orders.length === 0 && (
        <p className="surface customer-record">
          You have no payment records yet.
        </p>
      )}
      <div className="customer-record-list">
        {orders.map((order) => (
          <article
            className="surface customer-record customer-payment-record"
            key={order.orderId}
          >
            <div className="customer-payment-record__summary">
              <strong>
                {formatCustomerMoney(
                  Number(order.paymentAmount ?? order.total),
                )}
              </strong>
              <span>
                {order.orderNumber} · {order.paymentMethod}
              </span>
            </div>
            <CustomerStatusBadge className="customer-payment-record__badge">
              {order.recordedPaymentStatus ||
                order.paymentStatus ||
                "Not recorded"}
            </CustomerStatusBadge>
          </article>
        ))}
      </div>
    </div>
  );
}
