import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";

import "../../styles/customer/customer-services.css";

const SERVICE_URL = "/api/customer/account/my-services";

function formatSchedule(value) {
  if (!value) return "Schedule not specified";

  const [date, time] = String(value).replace("T", " ").split(" ");
  if (!date) return "Schedule not specified";
  return time ? `${date} at ${time.slice(0, 5)}` : date;
}

function formatMobileSchedule(value) {
  if (!value) return "Schedule not specified";

  const [datePart, timePart = "00:00"] = String(value)
    .replace("T", " ")
    .split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute);

  if (!Number.isFinite(date.getTime())) return formatSchedule(value);

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatPrice(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}

function formatAircon(service) {
  if (!service.airconSource && !service.airconBrand && !service.airconModel) {
    return "";
  }

  const horsepower = Number(service.airconHorsepower);
  const parts = [
    service.airconBrand,
    service.airconModel,
    Number.isFinite(horsepower) && horsepower > 0 ? `${horsepower} HP` : null,
  ].filter(Boolean);

  const source =
    service.airconSource === "PURCHASED"
      ? "Purchased from AV Cooling"
      : service.airconSource === "CUSTOMER_OWNED"
        ? "Customer-owned aircon"
        : null;

  return [parts.join(" · "), source].filter(Boolean).join(" — ");
}

function getEditValues(service) {
  const preferredStart = String(service.preferredStart || "").replace("T", " ");
  const [preferredDate = "", preferredTime = ""] = preferredStart.split(" ");

  return {
    preferredDate,
    preferredTime: preferredTime.slice(0, 5),
    contactNumber: service.contactNumber || "",
    serviceAddress: service.serviceAddress || "",
    destinationAddress: service.destinationAddress || "",
    concern: service.concern || "",
    notes: service.notes || "",
  };
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const { serviceId } = useParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  useRealtimeRefresh(["services", "schedules", "payments"], setRetryCount);
  const [notice, setNotice] = useState("");

  const [selectedRequestId, setSelectedRequestId] = useState(serviceId ?? null);
  const [dialogMode, setDialogMode] = useState("details");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const dialogRef = useRef(null);

  const selectedService = services.find(
    (service) => String(service.requestId) === String(selectedRequestId),
  );

  useEffect(() => {
    const controller = new AbortController();

    async function fetchMyServices() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(SERVICE_URL, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (
          response.data?.success !== true ||
          !Array.isArray(response.data.services)
        ) {
          throw new Error("Invalid service bookings response.");
        }

        setServices(response.data.services);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setServices([]);
        setError(
          requestError.response?.status === 401
            ? "Please log in to view your service bookings."
            : requestError.response?.data?.message ||
                requestError.message ||
                "Unable to load your service bookings.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchMyServices();
    return () => controller.abort();
  }, [retryCount]);

  // Links from customer notifications open the matching service details.
  useEffect(() => {
    if (serviceId) {
      setSelectedRequestId(serviceId);
      setDialogMode("details");
    }
  }, [serviceId]);

  useEffect(() => {
    if (!selectedService) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [selectedService]);

  function openDialog(service, mode = "details") {
    setSelectedRequestId(service.requestId);
    setDialogMode(mode);
    setDraft(getEditValues(service));
    setActionError("");
  }

  function closeDialog() {
    if (!saving) dialogRef.current?.close();
  }

  function switchMode(mode) {
    if (mode === "edit" && selectedService) {
      setDraft(getEditValues(selectedService));
    }
    setDialogMode(mode);
    setActionError("");
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitAction(action) {
    if (!selectedService || saving) return;

    if (
      (action === "edit" && !selectedService.canEdit) ||
      (action === "cancel" && !selectedService.canCancel) ||
      (action === "delete" && !selectedService.canDelete)
    ) {
      setActionError("This action is no longer available for this request.");
      return;
    }

    setSaving(true);
    setActionError("");
    const url = `${SERVICE_URL}/${encodeURIComponent(selectedService.requestId)}`;
    const revision = Number(selectedService.revision);

    try {
      if (action === "edit") {
        await api.patch(url, {
          revision,
          preferredDate: draft.preferredDate,
          preferredTime: draft.preferredTime,
          contactNumber: draft.contactNumber.trim(),
          serviceAddress: draft.serviceAddress.trim(),
          destinationAddress:
            selectedService.serviceType === "relocation"
              ? draft.destinationAddress.trim()
              : null,
          concern: draft.concern.trim(),
          notes: draft.notes.trim(),
        });
      } else if (action === "cancel") {
        await api.post(`${url}/cancel`, { revision });
      } else if (action === "delete") {
        await api.delete(url, { data: { revision } });
      }

      setNotice(
        action === "edit"
          ? "Service details updated successfully."
          : action === "cancel"
            ? "Service request cancelled successfully."
            : "Cancelled request removed from your history.",
      );
      dialogRef.current?.close();
      setRetryCount((count) => count + 1);
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message ||
          "Unable to save your change. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="customer-module customer-services-page">
      <CustomerPageHeader
        Icon={Wrench}
        title="Service Bookings"
        copy="View booking details, update pending requests, or cancel before work begins."
      />

      {notice && (
        <p className="customer-service-notice" role="status">
          {notice}
        </p>
      )}

      <div className="customer-record-list">
        {loading && <p role="status">Loading your service bookings...</p>}

        {!loading && error && (
          <div className="surface customer-record">
            <div>
              <strong>Unable to load services</strong>
              <span role="alert">{error}</span>
            </div>
            <button
              className="btn btn-soft"
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="surface customer-record">
            <div>
              <strong>No service bookings yet</strong>
              <span>Your submitted service requests will appear here.</span>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          services.map((service) => (
            <article
              className="surface customer-record customer-service-desktop-record"
              key={service.requestId}
            >
              <div>
                <strong>{service.serviceName}</strong>
                <span>
                  Request #{service.requestId}
                  {" · "}
                  {formatSchedule(service.preferredStart)}
                </span>
                {formatAircon(service) && (
                  <small className="customer-service-aircon-summary">
                    Aircon: {formatAircon(service)}
                  </small>
                )}
                <small>{service.serviceAddress}</small>
                {service.destinationAddress && (
                  <small>Destination: {service.destinationAddress}</small>
                )}
              </div>

              <div className="customer-service-desktop-side">
                <CustomerStatusBadge>{service.status}</CustomerStatusBadge>
                <div className="customer-service-desktop-buttons">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => openDialog(service)}
                  >
                    View details <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  {service.canEdit && (
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => openDialog(service, "edit")}
                    >
                      <Pencil size={16} aria-hidden="true" /> Edit
                    </button>
                  )}
                  {service.canCancel && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => openDialog(service, "confirmCancel")}
                    >
                      <XCircle size={16} aria-hidden="true" /> Cancel
                    </button>
                  )}
                  {service.canDelete && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => openDialog(service, "confirmDelete")}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
      </div>

      {!loading && !error && services.length > 0 && (
        <ul
          className="customer-service-mobile-list"
          aria-label="Service requests"
        >
          {services.map((service) => (
            <li
              className="surface customer-service-mobile-row"
              key={service.requestId}
            >
              <div className="customer-service-mobile-summary">
                <strong title={service.serviceName}>
                  {service.serviceName || "Service request"}
                </strong>
                <span>Request #{service.requestId}</span>
                <span>{formatMobileSchedule(service.preferredStart)}</span>
                {formatAircon(service) && (
                  <small className="customer-service-aircon-summary">
                    {formatAircon(service)}
                  </small>
                )}
              </div>
              <div className="customer-service-mobile-actions">
                <CustomerStatusBadge>{service.status}</CustomerStatusBadge>
                <button
                  type="button"
                  className="customer-service-view-button"
                  onClick={() => openDialog(service)}
                  aria-label={`View details for request ${service.requestId}`}
                >
                  View details <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className="customer-service-mobile-dialog"
        aria-labelledby="customer-service-dialog-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => {
          setSelectedRequestId(null);
          setDialogMode("details");
          setActionError("");
          if (serviceId) navigate("/account/services", { replace: true });
        }}
      >
        {selectedService && (
          <>
            <div className="customer-service-mobile-dialog-head">
              <div>
                <span>Request #{selectedService.requestId}</span>
                <h2 id="customer-service-dialog-title">
                  {dialogMode === "edit"
                    ? "Edit service request"
                    : dialogMode === "confirmCancel"
                      ? "Cancel service request?"
                      : dialogMode === "confirmDelete"
                        ? "Delete cancelled request?"
                        : selectedService.serviceName || "Service details"}
                </h2>
              </div>
              <button
                type="button"
                className="customer-service-dialog-close"
                onClick={closeDialog}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {dialogMode === "details" && (
              <>
                <dl className="customer-service-mobile-details">
                  <div>
                    <dt>Service</dt>
                    <dd>{selectedService.serviceName}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <CustomerStatusBadge>
                        {selectedService.status}
                      </CustomerStatusBadge>
                    </dd>
                  </div>
                  {formatAircon(selectedService) && (
                    <div>
                      <dt>Aircon unit</dt>
                      <dd>{formatAircon(selectedService)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Preferred schedule</dt>
                    <dd>{formatSchedule(selectedService.preferredStart)}</dd>
                  </div>
                  <div>
                    <dt>Estimated base price</dt>
                    <dd>{formatPrice(selectedService.estimatedBasePrice)}</dd>
                  </div>
                  {selectedService.contactNumber && (
                    <div>
                      <dt>Contact number</dt>
                      <dd>{selectedService.contactNumber}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Service address</dt>
                    <dd>{selectedService.serviceAddress || "Not provided"}</dd>
                  </div>
                  {selectedService.destinationAddress && (
                    <div>
                      <dt>Destination address</dt>
                      <dd>{selectedService.destinationAddress}</dd>
                    </div>
                  )}
                  {selectedService.concern && (
                    <div>
                      <dt>Concern</dt>
                      <dd>{selectedService.concern}</dd>
                    </div>
                  )}
                  {selectedService.notes && (
                    <div>
                      <dt>Additional notes</dt>
                      <dd>{selectedService.notes}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Created</dt>
                    <dd>{formatSchedule(selectedService.createdAt)}</dd>
                  </div>
                </dl>
                {!selectedService.canEdit && !selectedService.canCancel && (
                  <p className="customer-service-locked-note">
                    This request can no longer be edited or cancelled from your
                    account. Contact AV Cooling if you need assistance.
                  </p>
                )}
                <div className="customer-service-dialog-actions">
                  {selectedService.canEdit && (
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => switchMode("edit")}
                    >
                      <Pencil size={16} aria-hidden="true" /> Edit info
                    </button>
                  )}
                  {selectedService.canCancel && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => switchMode("confirmCancel")}
                    >
                      <XCircle size={16} aria-hidden="true" /> Cancel service
                    </button>
                  )}
                  {selectedService.canDelete && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => switchMode("confirmDelete")}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Delete request
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={closeDialog}
                  >
                    <X size={16} aria-hidden="true" /> Close details
                  </button>
                </div>
              </>
            )}

            {dialogMode === "edit" && draft && (
              <form
                className="customer-service-edit-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitAction("edit");
                }}
              >
                <p className="customer-service-edit-hint">
                  Update the schedule, contact number, address, concern, or
                  notes for
                  {` ${selectedService.serviceName}`} before staff begins work.
                  For aircon brand, model, or HP corrections, contact AV
                  Cooling.
                </p>
                <div className="customer-service-edit-dates">
                  <label>
                    Preferred date
                    <input
                      className="form-control"
                      type="date"
                      required
                      disabled={saving}
                      value={draft.preferredDate}
                      onChange={(event) =>
                        updateDraft("preferredDate", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Preferred time
                    <input
                      className="form-control"
                      type="time"
                      required
                      disabled={saving}
                      value={draft.preferredTime}
                      onChange={(event) =>
                        updateDraft("preferredTime", event.target.value)
                      }
                    />
                  </label>
                </div>
                <label>
                  Contact number
                  <input
                    className="form-control"
                    type="tel"
                    required
                    minLength={7}
                    maxLength={30}
                    disabled={saving}
                    value={draft.contactNumber}
                    onChange={(event) =>
                      updateDraft("contactNumber", event.target.value)
                    }
                  />
                </label>
                <label>
                  Service address
                  <textarea
                    className="form-control"
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={2}
                    disabled={saving}
                    value={draft.serviceAddress}
                    onChange={(event) =>
                      updateDraft("serviceAddress", event.target.value)
                    }
                  />
                </label>
                {selectedService.serviceType === "relocation" && (
                  <label>
                    Destination address
                    <textarea
                      className="form-control"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={2}
                      disabled={saving}
                      value={draft.destinationAddress}
                      onChange={(event) =>
                        updateDraft("destinationAddress", event.target.value)
                      }
                    />
                  </label>
                )}
                <label>
                  Concern (optional)
                  <textarea
                    className="form-control"
                    maxLength={3000}
                    rows={2}
                    disabled={saving}
                    value={draft.concern}
                    onChange={(event) =>
                      updateDraft("concern", event.target.value)
                    }
                  />
                </label>
                <label>
                  Notes (optional)
                  <textarea
                    className="form-control"
                    maxLength={3000}
                    rows={2}
                    disabled={saving}
                    value={draft.notes}
                    onChange={(event) =>
                      updateDraft("notes", event.target.value)
                    }
                  />
                </label>
                {actionError && (
                  <p role="alert" className="customer-service-action-error">
                    {actionError}
                  </p>
                )}
                <div className="customer-service-dialog-actions">
                  <button
                    type="submit"
                    className="btn btn-dark"
                    disabled={saving}
                  >
                    <Save size={16} aria-hidden="true" />{" "}
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={saving}
                    onClick={() => switchMode("details")}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> Back to details
                  </button>
                </div>
              </form>
            )}

            {dialogMode === "confirmCancel" && (
              <div className="customer-service-confirm">
                <p>
                  Are you sure you want to cancel{" "}
                  <strong>{selectedService.serviceName}</strong> (request #
                  {selectedService.requestId})?
                </p>
                <p>This will change the request status to Cancelled.</p>
                {actionError && (
                  <p role="alert" className="customer-service-action-error">
                    {actionError}
                  </p>
                )}
                <div className="customer-service-dialog-actions">
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={saving}
                    onClick={() => submitAction("cancel")}
                  >
                    <XCircle size={16} aria-hidden="true" />{" "}
                    {saving ? "Cancelling..." : "Yes, cancel request"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={saving}
                    onClick={() => switchMode("details")}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> No, keep request
                  </button>
                </div>
              </div>
            )}

            {dialogMode === "confirmDelete" && (
              <div className="customer-service-confirm">
                <p>
                  Remove request #{selectedService.requestId} from your service
                  history?
                </p>
                <p>You cannot undo this action from your account.</p>
                {actionError && (
                  <p role="alert" className="customer-service-action-error">
                    {actionError}
                  </p>
                )}
                <div className="customer-service-dialog-actions">
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={saving}
                    onClick={() => submitAction("delete")}
                  >
                    <Trash2 size={16} aria-hidden="true" />{" "}
                    {saving ? "Deleting..." : "Yes, delete request"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={saving}
                    onClick={() => switchMode("details")}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> No, keep request
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
