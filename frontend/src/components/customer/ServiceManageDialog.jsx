import { useEffect, useId, useRef, useState } from "react";

import { X, AlertTriangle } from "lucide-react";

import api from "../../../api/api.js";

export default function ServiceManageDialog({
  service,
  mode,
  onClose,
  onSaved,
}) {
  const dialog = useRef(null);
  const initialFocus = useRef(null);
  const submitting = useRef(false);
  const errorRef = useRef(null);

  const titleId = useId();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState(() => {
    const [date = "", time = ""] = String(service.preferredStart || "")
      .replace("T", " ")
      .split(" ");

    return {
      preferredDate: date,
      preferredTime: time.slice(0, 5),
      contactNumber: service.contactNumber || "",
      serviceAddress: service.serviceAddress || "",
      destinationAddress: service.destinationAddress || "",
      concern: service.concern || "",
      notes: service.notes || "",
    };
  });

  const editing = mode === "edit";
  const cancelling = mode === "cancel";

  const title = editing
    ? "Edit service details"
    : cancelling
      ? "Cancel this service?"
      : "Remove from history?";

  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    const oldOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    node.showModal();
    initialFocus.current?.focus();

    return () => {
      node.close();

      document.body.style.overflow = oldOverflow;

      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function update(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    setError("");

    if (
      editing &&
      Date.parse(`${form.preferredDate}T${form.preferredTime}:00+08:00`) <=
        Date.now()
    ) {
      setError("Choose a future date and time in Philippine time.");

      return;
    }

    submitting.current = true;
    setBusy(true);

    const url = `/api/customer/account/my-services/${service.requestId}`;

    const data = {
      revision: service.revision,
    };

    try {
      const response = editing
        ? await api.patch(url, {
            ...data,
            ...form,
          })
        : cancelling
          ? await api.post(`${url}/cancel`, data)
          : await api.delete(url, { data });

      if (!response.data?.success) {
        throw new Error("The request could not be saved.");
      }

      onSaved(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save. Check your connection and try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="service-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();

        if (!submitting.current) {
          onClose();
        }
      }}
    >
      <div className="service-dialog__head">
        <div>
          <p className="service-eyebrow">REQUEST #{service.requestId}</p>

          <h2 id={titleId}>{title}</h2>
        </div>

        <button
          className="service-icon-button"
          type="button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={submit} aria-busy={busy}>
        <div className="service-dialog__body">
          <p className="service-dialog__summary">{service.serviceName}</p>

          {error && (
            <p
              className="service-alert service-alert--error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {error}
            </p>
          )}

          {editing ? (
            <fieldset className="service-form" disabled={busy}>
              <legend className="service-sr-only">Booking information</legend>

              <p className="service-form__wide service-help">
                Update your booking below. Preferred schedules are in Philippine
                time and remain subject to approval.
              </p>

              <label>
                Preferred date
                <input
                  ref={initialFocus}
                  type="date"
                  name="preferredDate"
                  required
                  value={form.preferredDate}
                  onChange={update}
                />
              </label>

              <label>
                Preferred time
                <input
                  type="time"
                  name="preferredTime"
                  required
                  value={form.preferredTime}
                  onChange={update}
                />
              </label>

              <label className="service-form__wide">
                Contact number
                <input
                  type="tel"
                  name="contactNumber"
                  autoComplete="tel"
                  required
                  minLength={7}
                  maxLength={30}
                  value={form.contactNumber}
                  onChange={update}
                />
              </label>

              <label className="service-form__wide">
                Service address
                <textarea
                  name="serviceAddress"
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={form.serviceAddress}
                  onChange={update}
                />
              </label>

              {service.serviceType === "relocation" && (
                <label className="service-form__wide">
                  Destination address
                  <textarea
                    name="destinationAddress"
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={3}
                    value={form.destinationAddress}
                    onChange={update}
                  />
                </label>
              )}

              <label className="service-form__wide">
                Concern
                <span className="service-optional">(optional)</span>
                <textarea
                  name="concern"
                  maxLength={3000}
                  rows={3}
                  value={form.concern}
                  onChange={update}
                />
              </label>

              <label className="service-form__wide">
                Additional notes
                <span className="service-optional">(optional)</span>
                <textarea
                  name="notes"
                  maxLength={3000}
                  rows={3}
                  value={form.notes}
                  onChange={update}
                />
              </label>

              <p className="service-form__wide service-help">
                Service type and pricing cannot be changed here.
              </p>
            </fieldset>
          ) : (
            <div className="service-confirm-copy">
              <AlertTriangle size={28} aria-hidden="true" />

              <p>
                {cancelling
                  ? "This will cancel your pending service request. You can book a new service later if you need it."
                  : "This cancelled request will disappear from your service history. AV Cooling will keep its business record."}
              </p>
            </div>
          )}
        </div>

        <div className="service-dialog__footer">
          <button
            ref={editing ? undefined : initialFocus}
            type="button"
            className="service-button service-button--quiet"
            disabled={busy}
            onClick={onClose}
          >
            {editing
              ? "Discard changes"
              : cancelling
                ? "Keep service"
                : "Keep in history"}
          </button>

          <button
            type="submit"
            className={`service-button ${
              editing ? "service-button--primary" : "service-button--danger"
            }`}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save changes"
                : cancelling
                  ? "Confirm cancellation"
                  : "Remove from history"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
