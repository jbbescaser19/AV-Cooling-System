import { useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader.jsx";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge.jsx";
import PayMongoAction from "../../components/payments/PayMongoAction.jsx";
import { formatCustomerMoney } from "../../utils/customerAccountUtils.js";
import "../../styles/ecommerce/payment-transfers.css";
import "../../styles/ecommerce/paymongo.css";

const READY = new Set(["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]);
const label = (code) =>
  code === "CASH"
    ? "Cash"
    : code === "GCASH"
      ? "GCash · PayMongo"
      : "QR Ph / bank app · PayMongo";

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useRealtimeRefresh(["payments", "orders", "services"], setRefresh);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api.get("/api/customer/orders", { signal: controller.signal }),
      api.get("/api/customer/services/payments", { signal: controller.signal }),
    ])
      .then(([orderData, serviceData]) => {
        if (controller.signal.aborted) return;
        setOrders(orderData.data.orders || []);
        setServices(serviceData.data.payments || []);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.response?.data?.message || "Could not load payment records.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);

  const records = useMemo(
    () => [
      ...orders.map((order) => ({
        key: `order-${order.orderNumber}`,
        kind: "ORDER",
        identifier: order.orderNumber,
        name: `Order ${order.orderNumber}`,
        amount: order.paymentAmount ?? order.total,
        method: order.paymentCode,
        status: order.recordedPaymentStatus || order.paymentStatus,
        sourceStatus: order.status,
        canPay: order.channel === "ONLINE",
      })),
      ...services.map((payment) => ({
        key: `service-${payment.requestId}`,
        kind: "SERVICE",
        identifier: payment.requestId,
        name: `${payment.service || "Service"} · #${payment.requestId}`,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        sourceStatus: payment.serviceStatus,
        canPay: true,
      })),
    ],
    [orders, services],
  );

  return (
    <div className="customer-module customer-transfers">
      <CustomerPageHeader
        Icon={CreditCard}
        title="My Payments"
        copy="Pay cash as arranged with the store, or complete GCash / QR Ph payments securely with PayMongo."
      />
      <div className="surface customer-transfer-safety">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Secure payment.</strong> AV Cooling never asks for your GCash
          PIN, bank password, or OTP. Online payments open PayMongo's official
          hosted checkout. Payment status only changes after the provider
          confirms it.
        </p>
      </div>
      <div className="customer-transfer-toolbar">
        <span>
          {records.length} payment record{records.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="btn btn-soft"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={15} /> Refresh status
        </button>
      </div>
      {error && (
        <p role="alert" className="customer-transfer-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading payments…</p>}
      {!loading && !records.length && (
        <p className="surface customer-record">
          You have no payment records yet.
        </p>
      )}
      <div className="customer-record-list">
        {records.map((record) => (
          <article
            className="surface customer-record customer-transfer-card"
            key={record.key}
          >
            <div className="customer-transfer-head">
              <div>
                <strong>{record.name}</strong>
                <span>{label(record.method)}</span>
              </div>
              <CustomerStatusBadge>
                {record.status || "PENDING"}
              </CustomerStatusBadge>
            </div>
            <div className="customer-transfer-total">
              <span>Amount {record.status === "PAID" ? "paid" : "due"}</span>
              <strong>{formatCustomerMoney(Number(record.amount || 0))}</strong>
            </div>
            {record.status === "PAID" ? (
              <p className="customer-transfer-notice">
                Payment confirmed. No more payment is needed.
              </p>
            ) : record.method === "CASH" ? (
              <p className="customer-transfer-help">
                The store will coordinate cash collection. Management records
                the payment after actual receipt.
              </p>
            ) : record.status !== "PENDING" ? (
              <p className="customer-transfer-help">
                This payment is not available for online checkout. Contact AV
                Cooling.
              </p>
            ) : !record.canPay ? (
              <p className="customer-transfer-help">
                Contact AV Cooling about this payment.
              </p>
            ) : !READY.has(record.sourceStatus) ? (
              <p className="customer-transfer-help">
                Waiting for AV Cooling to confirm the booking and final price
                before payment opens.
              </p>
            ) : (
              <PayMongoAction
                kind={record.kind}
                identifier={record.identifier}
              />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
