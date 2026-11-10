import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Package, Wrench } from "lucide-react";
import api from "../../../api/api.js";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import "../../styles/customer/customer-notifications.css";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const scheduleLabel = (value) =>
  value ? String(value).replace("T", " at ") : "Awaiting confirmation";

export default function CustomerRecordDetailPage({ kind }) {
  const { orderId, serviceId } = useParams();
  const isOrder = kind === "ORDER";
  const ref = isOrder ? orderId : serviceId;
  const [record, setRecord] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRecord(null);
    Promise.all([
      isOrder
        ? api.get(`/api/customer/orders/${encodeURIComponent(ref)}`, {
            signal: controller.signal,
          })
        : api.get("/api/customer/account/my-services", {
            signal: controller.signal,
          }),
      api.get(
        `/api/customer/notifications/activity/${kind}/${encodeURIComponent(ref)}`,
        { signal: controller.signal },
      ),
    ])
      .then(([details, activity]) => {
        if (controller.signal.aborted) return;
        const found = isOrder
          ? details.data.order
          : (details.data.services || []).find(
              (item) => String(item.requestId) === String(ref),
            );
        if (!found)
          throw new Error("This record was not found in your account.");
        setRecord(found);
        setEvents(activity.data.events || []);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.response?.data?.message || e.message || "Unable to load details.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isOrder, kind, ref]);

  const back = isOrder ? "/account/orders" : "/account/services";
  return (
    <div className="customer-module notification-record-page">
      <Link className="notification-back" to={back}>
        ← Back to {isOrder ? "orders" : "services"}
      </Link>
      <div className="notification-record-header">
        {isOrder ? <Package size={20} /> : <Wrench size={20} />}
        <h1>{isOrder ? "Order details" : "Service details"}</h1>
      </div>
      {loading && <p role="status">Loading details…</p>}
      {error && (
        <p role="alert" className="notification-error">
          {error}
        </p>
      )}
      {record && (
        <>
          <section className="surface notification-record-card">
            <div className="notification-record-row">
              <span>Reference</span>
              <strong>
                {isOrder ? record.orderNumber : `Request #${record.requestId}`}
              </strong>
            </div>
            <div className="notification-record-row">
              <span>Status</span>
              <CustomerStatusBadge>{record.status}</CustomerStatusBadge>
            </div>
            <div className="notification-record-row">
              <span>{isOrder ? "Recipient" : "Service"}</span>
              <strong>
                {isOrder ? record.recipientName : record.serviceName}
              </strong>
            </div>
            <div className="notification-record-row">
              <span>Address</span>
              <strong>
                {isOrder ? record.deliveryAddress : record.serviceAddress}
              </strong>
            </div>
            <div className="notification-record-row">
              <span>Contact</span>
              <strong>{record.contactNumber || "Not provided"}</strong>
            </div>
            <div className="notification-record-row">
              <span>
                <CalendarDays size={14} /> Schedule
              </span>
              <strong>
                {scheduleLabel(
                  isOrder ? record.preferredSchedule : record.preferredStart,
                )}
              </strong>
            </div>
            {isOrder && (
              <>
                <div className="notification-record-row">
                  <span>Payment</span>
                  <strong>{record.paymentStatus}</strong>
                </div>
                <div className="notification-record-row">
                  <span>Total</span>
                  <strong>{money(record.total)}</strong>
                </div>
                <h2>Products</h2>
                {(record.items || []).map((item) => (
                  <div key={item.variantId} className="notification-record-row">
                    <span>
                      {item.qty} × {item.name} {item.hp}
                    </span>
                    <strong>{money(item.lineTotal)}</strong>
                  </div>
                ))}
              </>
            )}
          </section>
          <section className="surface notification-record-card">
            <h2>Order and service activity</h2>
            {events.length ? (
              <ol className="notification-activity-list">
                {events.map((event, index) => (
                  <li key={index}>
                    <strong>{event.code.replaceAll("_", " ")}</strong>
                    {event.note && <p>{event.note}</p>}
                    {event.schedule && (
                      <p>Scheduled: {scheduleLabel(event.schedule)}</p>
                    )}
                    <small>
                      {new Date(event.createdAt).toLocaleString("en-PH")}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No staff updates recorded yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
