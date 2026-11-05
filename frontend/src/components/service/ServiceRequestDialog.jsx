import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, X } from "lucide-react";

import api from "../../../api/api.js";
import SavedAddressSelector from "../common/SavedAddressSelector";

import "../../styles/ecommerce/pages.css";

function resolveServiceType(service) {
  const value =
    service?.serviceType ?? service?.type ?? service?.id ?? service?.name ?? "";

  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const compact = slug.replace(/-/g, "");

  if (compact === "emergency" || compact === "emergencyservice") {
    return "emergency";
  }

  if (
    compact === "troubleshooting" ||
    compact === "troubleshootingservice" ||
    compact === "troubleshoot"
  ) {
    return "troubleshooting";
  }

  return slug;
}

function getTodayPH() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ServiceRequestDialog({ service, onClose }) {
  const navigate = useNavigate();

  const serviceType = resolveServiceType(service);
  const serviceName = service?.name ?? service?.serviceName ?? "Service";

  const isRelocation = serviceType === "relocation";

  const isValidServiceType = /^[a-z][a-z0-9-]{1,39}$/.test(serviceType);

  const [form, setForm] = useState({
    date: "",
    time: "09:00",
    address: "",
    destinationAddress: "",
    concern: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, submitting]);

  function set(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const handleAddressChange = useCallback((address) => {
    setForm((current) => ({
      ...current,
      address,
    }));
  }, []);

  async function submit(event) {
    event.preventDefault();

    if (submitting || success) return;

    setError("");

    if (!isValidServiceType) {
      setError("This service type is not configured correctly.");
      return;
    }

    if (!form.date || !form.time) {
      setError("Please select a preferred date and time.");
      return;
    }

    if (!form.address.trim()) {
      setError("Please enter a service address.");
      return;
    }

    if (isRelocation && !form.destinationAddress.trim()) {
      setError("Please enter the relocation destination address.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/api/customer/services/requests", {
        serviceType,
        preferredDate: form.date,
        preferredTime: form.time,
        serviceAddress: form.address.trim(),
        destinationAddress: isRelocation
          ? form.destinationAddress.trim()
          : null,
        concern: form.concern.trim(),
        notes: form.notes.trim(),
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to submit your service request.",
        );
      }

      setSuccess(
        response.data.message ||
          "Your service request was submitted successfully.",
      );
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        navigate("/login", {
          replace: true,
          state: {
            message: "Please log in to request a service.",
          },
        });
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to submit your service request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="service-booking-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <section
        className="service-booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Request ${serviceName}`}
      >
        <div className="service-booking-head">
          <div>
            <span>
              {isRelocation ? "Relocation Request" : "Service Request"}
            </span>

            <h2>{serviceName}</h2>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {!isValidServiceType && (
          <p className="form-error" role="alert">
            This service type is not configured correctly.
          </p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {success ? (
          <div className="service-booking-grid">
            <p role="status">{success}</p>

            <div className="service-booking-actions">
              <button type="button" className="btn btn-dark" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="service-booking-grid">
              <label>
                Preferred date
                <input
                  className="form-control"
                  type="date"
                  value={form.date}
                  min={getTodayPH()}
                  onChange={(event) => set("date", event.target.value)}
                  required
                  disabled={submitting}
                />
              </label>

              <label>
                Preferred time
                <input
                  className="form-control"
                  type="time"
                  value={form.time}
                  onChange={(event) => set("time", event.target.value)}
                  required
                  disabled={submitting}
                />
              </label>

              <SavedAddressSelector
                className="full"
                title={
                  isRelocation ? "Current unit address" : "Service address"
                }
                value={form.address}
                onChange={handleAddressChange}
                disabled={submitting}
              />

              {isRelocation && (
                <label className="full">
                  Relocation destination
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.destinationAddress}
                    onChange={(event) =>
                      set("destinationAddress", event.target.value)
                    }
                    placeholder="House/Unit, Street, Barangay, City, Province"
                    required
                    disabled={submitting}
                  />
                </label>
              )}

              <label className="full">
                {isRelocation ? "Relocation details" : "Concern"}

                <textarea
                  className="form-control"
                  rows={3}
                  value={form.concern}
                  onChange={(event) => set("concern", event.target.value)}
                  placeholder={
                    isRelocation
                      ? "Describe where the unit will be moved."
                      : "Describe the issue or service needed."
                  }
                  disabled={submitting}
                />
              </label>

              <label className="full">
                Notes
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.notes}
                  onChange={(event) => set("notes", event.target.value)}
                  placeholder="Additional information (optional)"
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="service-booking-actions">
              <button
                type="button"
                className="btn btn-soft"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-dark"
                disabled={submitting || !isValidServiceType}
              >
                <CalendarDays size={16} />

                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
