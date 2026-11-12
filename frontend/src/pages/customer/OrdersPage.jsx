import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  Pencil,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import api from "../../../api/api.js";
import CustomerDialog from "../../components/customer/CustomerDialog";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import SavedAddressSelector from "../../components/common/SavedAddressSelector";
import { formatCustomerMoney } from "../../utils/customerAccountUtils";
import "../../styles/customer/order-management.css";

const FILTERS = [
  { id: "all", label: "All orders" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const CANCEL_REASONS = [
  { value: "CHANGED_MIND", label: "Changed my mind" },
  { value: "WRONG_DETAILS", label: "Wrong order details" },
  { value: "ORDERED_BY_MISTAKE", label: "Ordered by mistake" },
  { value: "OTHER", label: "Other reason" },
];

const formatDate = (date) => {
  if (!date) return "Not available";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? String(date)
    : parsed.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const formatSchedule = (value) =>
  value ? String(value).replace("T", " · ").slice(0, 18) : "Not specified";

function draftFromOrder(order) {
  return {
    recipientName: order.recipientName || "",
    contactNumber: order.contactNumber || "",
    fulfillment: order.fulfillment || "DELIVERY",
    deliveryAddress: order.deliveryAddress || "",
    customerNotes: order.customerNotes || "",
    preferredSchedule: order.preferredSchedule || "",
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [mode, setMode] = useState("details");
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState("CHANGED_MIND");
  const [reasonDetails, setReasonDetails] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

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
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message || "Unable to load orders.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const selected = orders.find((order) => order.orderNumber === selectedNumber);
  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (filter === "completed") return order.status === "COMPLETED";
        if (filter === "cancelled") return order.status === "CANCELLED";
        if (filter === "active")
          return !["COMPLETED", "CANCELLED"].includes(order.status);
        return true;
      }),
    [filter, orders],
  );

  function openOrder(order) {
    setSelectedNumber(order.orderNumber);
    setDraft(draftFromOrder(order));
    setMode("details");
    setActionError("");
    setMessage("");
  }

  function openEdit() {
    if (!selected?.canManage) return;
    setDraft(draftFromOrder(selected));
    setActionError("");
    setMode("edit");
  }

  function openCancel() {
    if (!selected?.canManage) return;
    setReason("CHANGED_MIND");
    setReasonDetails("");
    setActionError("");
    setMode("cancel");
  }

  function onUpdatedOrder(nextOrder) {
    setOrders((previous) =>
      previous.map((order) =>
        order.orderNumber === nextOrder.orderNumber ? nextOrder : order,
      ),
    );
    setMode("details");
    setActionError("");
  }

  async function saveChanges(event) {
    event.preventDefault();
    if (!selected?.canManage || saving || !draft) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await api.patch(
        `/api/customer/orders/${encodeURIComponent(selected.orderNumber)}`,
        {
          ...draft,
          recipientName: draft.recipientName.trim(),
          contactNumber: draft.contactNumber.trim(),
          deliveryAddress:
            draft.fulfillment === "DELIVERY"
              ? draft.deliveryAddress.trim()
              : null,
          customerNotes: draft.customerNotes.trim(),
          preferredSchedule: draft.preferredSchedule || null,
        },
      );
      onUpdatedOrder(response.data.order);
      setMessage("Order details updated successfully.");
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message || "Unable to update this order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancellation(event) {
    event.preventDefault();
    if (!selected?.canManage || saving) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await api.post(
        `/api/customer/orders/${encodeURIComponent(selected.orderNumber)}/cancel`,
        { reason, details: reasonDetails.trim() },
      );
      onUpdatedOrder(response.data.order);
      setMessage("Order cancelled. Your order history has been preserved.");
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message || "Unable to cancel this order.",
      );
    } finally {
      setSaving(false);
    }
  }

  function setField(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <div className="customer-module customer-orders">
      <CustomerPageHeader
        Icon={Package}
        title="My Orders"
        copy="View your purchases, update pending details, or cancel before processing."
      />

      {message && (
        <p className="order-notice" role="status">
          {message}
        </p>
      )}
      {loading && (
        <p className="order-loading" role="status">
          Loading your orders…
        </p>
      )}
      {!loading && error && (
        <div className="surface order-empty" role="alert">
          <p>{error}</p>
          <button
            className="order-button order-button--secondary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            className="order-filters"
            role="group"
            aria-label="Filter orders"
          >
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`order-filter${filter === option.id ? " order-filter--active" : ""}`}
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="surface order-empty">
              <ShoppingBag size={25} aria-hidden="true" />
              <strong>
                {orders.length ? "No orders in this category" : "No orders yet"}
              </strong>
              <p>
                {orders.length
                  ? "Choose another filter to see your orders."
                  : "Your new orders will appear here."}
              </p>
            </div>
          ) : (
            <div className="order-list">
              {filtered.map((order) => (
                <article className="surface order-card" key={order.orderId}>
                  <div className="order-card-top">
                    <div className="order-card-title">
                      <span className="order-muted">
                        Order placed {formatDate(order.orderedAt)}
                      </span>
                      <strong>{order.orderNumber}</strong>
                    </div>
                    <CustomerStatusBadge>{order.status}</CustomerStatusBadge>
                  </div>
                  <div className="order-card-meta">
                    <span>
                      {order.items?.length || 0} product
                      {order.items?.length === 1 ? "" : "s"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {order.fulfillment === "PICKUP"
                        ? "Store pickup"
                        : "Delivery + installation"}
                    </span>
                  </div>
                  <div className="order-card-bottom">
                    <div className="order-card-price">
                      <span className="order-muted">Total</span>
                      <strong>
                        {formatCustomerMoney(Number(order.total))}
                      </strong>
                    </div>
                    <button
                      className="order-button order-button--secondary"
                      type="button"
                      onClick={() => openOrder(order)}
                    >
                      Details <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <CustomerDialog
          title={
            mode === "edit"
              ? "Edit order details"
              : mode === "cancel"
                ? "Cancel order"
                : "Order details"
          }
          onClose={() => {
            if (!saving) setSelectedNumber(null);
          }}
        >
          <div className="order-modal-content">
            <div className="order-modal-intro">
              <span className="order-muted">{selected.orderNumber}</span>
              <CustomerStatusBadge>{selected.status}</CustomerStatusBadge>
            </div>

            {actionError && (
              <p className="order-error" role="alert">
                {actionError}
              </p>
            )}

            {mode === "details" && (
              <>
                {message && (
                  <p className="order-notice" role="status">
                    {message}
                  </p>
                )}
                <div className="order-detail-list">
                  <div>
                    <span>Placed</span>
                    <strong>{formatDate(selected.orderedAt)}</strong>
                  </div>
                  <div>
                    <span>Payment method</span>
                    <strong>{selected.paymentMethod || "Not specified"}</strong>
                  </div>
                  <div className="order-payment-status-row">
                    <span>Payment status</span>
                    <CustomerStatusBadge>
                      {selected.paymentStatus || "Not recorded"}
                    </CustomerStatusBadge>
                  </div>
                  <div>
                    <span>Method</span>
                    <strong>
                      {selected.fulfillment === "PICKUP"
                        ? "Store pickup"
                        : "Delivery + installation"}
                    </strong>
                  </div>
                  <div>
                    <span>Recipient</span>
                    <strong>{selected.recipientName}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{selected.contactNumber}</strong>
                  </div>
                  {selected.deliveryAddress && (
                    <div>
                      <span>Address</span>
                      <strong>{selected.deliveryAddress}</strong>
                    </div>
                  )}
                  <div>
                    <span>Preferred schedule</span>
                    <strong>
                      {formatSchedule(selected.preferredSchedule)}
                    </strong>
                  </div>
                  {selected.customerNotes && (
                    <div>
                      <span>Notes</span>
                      <strong>{selected.customerNotes}</strong>
                    </div>
                  )}
                </div>
                <div className="order-modal-section">
                  <h3>Products</h3>
                  {(selected.items || []).map((item) => (
                    <div
                      className="order-product"
                      key={`${item.variantId}-${item.qty}`}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.hp} · Qty {item.qty}
                          {Boolean(item.installationIncluded) &&
                            " · Installation up to 10ft included"}
                        </span>
                      </div>
                      <strong>
                        {formatCustomerMoney(Number(item.lineTotal))}
                      </strong>
                    </div>
                  ))}
                  <div className="order-product order-product--total">
                    <strong>Order total</strong>
                    <strong>
                      {formatCustomerMoney(Number(selected.total))}
                    </strong>
                  </div>
                </div>
                {!!selected.history?.length && (
                  <div className="order-modal-section">
                    <h3>Order activity</h3>
                    <ol className="order-timeline">
                      {selected.history.map((entry, index) => (
                        <li key={`${entry.changedAt}-${index}`}>
                          <div>
                            {entry.newStatus && (
                              <CustomerStatusBadge>
                                {entry.newStatus}
                              </CustomerStatusBadge>
                            )}
                            {entry.notes && <span>{entry.notes}</span>}
                          </div>
                          <small>{formatDate(entry.changedAt)}</small>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {selected.canManage ? (
                  <div className="order-dialog-actions">
                    {selected.fulfillment === "DELIVERY" && (
                      <button
                        className="order-button order-button--primary"
                        type="button"
                        onClick={openEdit}
                      >
                        <Pencil size={15} /> Edit details
                      </button>
                    )}
                    <button
                      className="order-button order-button--danger"
                      type="button"
                      onClick={openCancel}
                    >
                      <XCircle size={15} /> Cancel order
                    </button>
                  </div>
                ) : (
                  <p className="order-helper">
                    <Clock3 size={15} /> Online changes are unavailable for this
                    order. Contact the store for assistance.
                  </p>
                )}
              </>
            )}

            {mode === "edit" && draft && (
              <form className="order-edit-form" onSubmit={saveChanges}>
                <p className="order-helper">
                  Changes are allowed before staff begin processing your unpaid
                  order. Products and prices cannot be changed here.
                </p>
                <div className="order-form-grid">
                  <label className="order-field">
                    Recipient name
                    <input
                      className="form-control"
                      value={draft.recipientName}
                      required
                      maxLength={150}
                      onChange={(e) =>
                        setField("recipientName", e.target.value)
                      }
                      disabled={saving}
                    />
                  </label>
                  <label className="order-field">
                    Contact number
                    <input
                      className="form-control"
                      type="tel"
                      inputMode="tel"
                      required
                      minLength={7}
                      maxLength={30}
                      pattern="[+0-9 ()-]{7,30}"
                      value={draft.contactNumber}
                      onChange={(e) =>
                        setField("contactNumber", e.target.value)
                      }
                      disabled={saving}
                    />
                  </label>
                  <div className="order-field">
                    <span>Fulfillment</span>
                    <strong>
                      Delivery + free standard installation (up to 10ft)
                    </strong>
                  </div>
                  <label className="order-field">
                    Preferred schedule (optional)
                    <input
                      className="form-control"
                      type="datetime-local"
                      value={draft.preferredSchedule}
                      onChange={(e) =>
                        setField("preferredSchedule", e.target.value)
                      }
                      disabled={saving}
                    />
                  </label>
                </div>
                {draft.fulfillment === "DELIVERY" && (
                  <div className="order-edit-address">
                    <div className="order-field-heading">
                      <MapPin size={15} /> Delivery address
                    </div>
                    <SavedAddressSelector
                      title="Choose a saved or new address"
                      value={draft.deliveryAddress}
                      onChange={(value) => setField("deliveryAddress", value)}
                      disabled={saving}
                    />
                  </div>
                )}
                <label className="order-field">
                  Additional notes (optional)
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={1000}
                    value={draft.customerNotes}
                    disabled={saving}
                    onChange={(e) => setField("customerNotes", e.target.value)}
                  />
                </label>
                <div className="order-dialog-actions">
                  <button
                    className="order-button order-button--secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setActionError("");
                      setMode("details");
                    }}
                  >
                    Back
                  </button>
                  <button
                    className="order-button order-button--primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            )}

            {mode === "cancel" && (
              <form className="order-edit-form" onSubmit={confirmCancellation}>
                <p className="order-cancel-note">
                  Cancel this order? This cannot be undone. No cash payment has
                  been collected.
                </p>
                <label className="order-field">
                  Reason for cancellation
                  <select
                    className="form-control"
                    value={reason}
                    disabled={saving}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {CANCEL_REASONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="order-field">
                  Additional details{" "}
                  {reason === "OTHER" ? "(required)" : "(optional)"}
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={300}
                    required={reason === "OTHER"}
                    minLength={reason === "OTHER" ? 5 : undefined}
                    value={reasonDetails}
                    disabled={saving}
                    onChange={(e) => setReasonDetails(e.target.value)}
                    placeholder="Briefly describe your reason"
                  />
                </label>
                <div className="order-dialog-actions">
                  <button
                    className="order-button order-button--secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setActionError("");
                      setMode("details");
                    }}
                  >
                    Keep order
                  </button>
                  <button
                    className="order-button order-button--danger-solid"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </CustomerDialog>
      )}
    </div>
  );
}
