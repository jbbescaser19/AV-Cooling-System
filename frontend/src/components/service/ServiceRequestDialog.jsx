import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, PackageCheck, ShoppingBag, X } from "lucide-react";

import api from "../../../api/api.js";
import AvailabilityPicker from "../scheduling/AvailabilityPicker";
import SavedAddressSelector from "../common/SavedAddressSelector";

import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/service-booking.css";

function resolveServiceType(service) {
  const value =
    service?.serviceType ?? service?.type ?? service?.id ?? service?.name ?? "";
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const compact = slug.replace(/-/g, "");

  if (compact === "emergency" || compact === "emergencyservice")
    return "emergency";
  if (
    ["troubleshooting", "troubleshootingservice", "troubleshoot"].includes(
      compact,
    )
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
  const isInstallation = serviceType === "installation";
  const validServiceType = /^[a-z][a-z0-9-]{1,39}$/.test(serviceType);

  const [form, setForm] = useState({
    date: "",
    time: "09:00",
    address: "",
    destinationAddress: "",
    concern: "",
    notes: "",
    airconSource: "CUSTOMER_OWNED",
    orderItemId: "",
    airconBrand: "",
    airconModel: "",
    airconHp: "",
  });
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [purchaseError, setPurchaseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Installation displays every customer purchase, including ones that cannot
  // be booked again. The customer can see the reason instead of an empty list.
  // Other services continue to use delivered units only.
  const displayedPurchases = useMemo(
    () =>
      isInstallation ? purchases : purchases.filter((item) => item.delivered),
    [purchases, isInstallation],
  );
  const chosenPurchase = displayedPurchases.find(
    (item) => String(item.orderItemId) === form.orderItemId,
  );

  function purchaseAvailability(item) {
    if (!item.delivered) {
      return {
        label: "Awaiting delivery",
        message:
          "This aircon has not been confirmed as delivered. You can book installation after delivery is recorded.",
      };
    }
    if (isInstallation && item.installationIncluded) {
      return {
        label: "Installation already included",
        message:
          "Installation is already included in this purchase. Check My Orders for the existing installation progress. A second installation request is not needed.",
      };
    }
    if (isInstallation && !item.installationEligible) {
      return {
        label: "Installation already booked",
        message:
          "A separate installation has already been booked for this purchase. Check your existing service requests or contact the store instead of booking twice.",
      };
    }
    return { label: "Available for this service", message: "" };
  }

  const chosenAvailability = chosenPurchase
    ? purchaseAvailability(chosenPurchase)
    : null;
  const purchaseCanBook = Boolean(
    chosenPurchase?.delivered &&
    (!isInstallation || chosenPurchase.installationEligible),
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, submitting]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/api/customer/services/aircon-purchases", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setPurchaseError(
            requestError.response?.data?.message ||
              "Could not load your AV Cooling purchases. You can still enter a unit you own.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPurchases(false);
      });
    return () => controller.abort();
  }, []);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const handleAddressChange = useCallback((address) => {
    setForm((current) => ({ ...current, address }));
  }, []);

  function changeSource(value) {
    setForm((current) => ({
      ...current,
      airconSource: value,
      orderItemId: "",
    }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || success || form.airconSource === "SHOP") return;
    setError("");

    if (!validServiceType) {
      setError("This service type is not configured correctly.");
      return;
    }
    if (!form.date || !form.time) {
      setError("Please select a preferred date and time.");
      return;
    }
    if (form.address.trim().length < 5) {
      setError("Enter a complete service address (at least 5 characters).");
      return;
    }
    if (isRelocation && form.destinationAddress.trim().length < 5) {
      setError("Enter the relocation destination address.");
      return;
    }
    if (form.airconSource === "PURCHASED" && !chosenPurchase) {
      setError("Select one of your AV Cooling aircon purchases.");
      return;
    }
    if (form.airconSource === "PURCHASED" && !purchaseCanBook) {
      setError(
        chosenAvailability?.message ||
          "This purchase cannot be booked for the selected service.",
      );
      return;
    }
    if (
      form.airconSource === "CUSTOMER_OWNED" &&
      (form.airconBrand.trim().length < 2 ||
        form.airconModel.trim().length < 2 ||
        !Number.isFinite(Number(form.airconHp)) ||
        Number(form.airconHp) < 0.5 ||
        Number(form.airconHp) > 20 ||
        Math.abs(
          Number(form.airconHp) * 10 - Math.round(Number(form.airconHp) * 10),
        ) > 1e-8)
    ) {
      setError("Enter your aircon brand, model, and a valid horsepower (HP).");
      return;
    }

    setSubmitting(true);
    try {
      const aircon =
        form.airconSource === "PURCHASED"
          ? { source: "PURCHASED", orderItemId: Number(form.orderItemId) }
          : {
              source: "CUSTOMER_OWNED",
              brand: form.airconBrand.trim(),
              model: form.airconModel.trim(),
              horsepower: Number(form.airconHp),
            };
      const { data } = await api.post("/api/customer/services/requests", {
        serviceType,
        preferredDate: form.date,
        preferredTime: form.time,
        serviceAddress: form.address.trim(),
        destinationAddress: isRelocation
          ? form.destinationAddress.trim()
          : null,
        concern: form.concern.trim(),
        notes: form.notes.trim(),
        aircon,
      });
      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to submit your service request.",
        );
      }
      setSuccess(
        data.message || "Your service request was submitted successfully.",
      );
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        navigate("/login", {
          replace: true,
          state: { message: "Please log in to request a service." },
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
        if (event.target === event.currentTarget && !submitting) onClose();
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

        {!validServiceType && (
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
              <fieldset className="service-aircon-unit full">
                <legend>
                  <PackageCheck size={17} aria-hidden="true" /> Air conditioner
                  details
                </legend>
                <p className="service-aircon-explanation">
                  {isInstallation
                    ? "Tell us which aircon needs installation. You can use one you already own or select an eligible delivered AV Cooling purchase."
                    : "Enter your aircon brand, model, and horsepower so our technicians know the unit's capacity."}
                </p>

                <label>
                  Where is your aircon from?
                  <select
                    className="form-control"
                    value={form.airconSource}
                    onChange={(event) => changeSource(event.target.value)}
                    disabled={submitting}
                  >
                    <option value="CUSTOMER_OWNED">
                      I already own an aircon
                    </option>
                    <option value="PURCHASED">Purchased from AV Cooling</option>
                    {isInstallation && (
                      <option value="SHOP">I want to buy an aircon</option>
                    )}
                  </select>
                </label>

                {form.airconSource === "SHOP" && (
                  <div className="service-aircon-shopping">
                    <p>
                      Visit our shop to choose an aircon. You can arrange
                      installation when purchasing.
                    </p>
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => navigate("/shop")}
                    >
                      <ShoppingBag size={16} /> Shop Aircons
                    </button>
                  </div>
                )}

                {form.airconSource === "PURCHASED" && (
                  <>
                    <label>
                      Select your purchased aircon
                      <select
                        className="form-control"
                        value={form.orderItemId}
                        onChange={(event) =>
                          set("orderItemId", event.target.value)
                        }
                        disabled={
                          submitting ||
                          loadingPurchases ||
                          !displayedPurchases.length
                        }
                        required
                      >
                        <option value="">
                          {loadingPurchases
                            ? "Loading purchases…"
                            : "Select your AV Cooling purchase"}
                        </option>
                        {displayedPurchases.map((item) => (
                          <option
                            key={item.orderItemId}
                            value={item.orderItemId}
                          >
                            {item.label}
                            {isInstallation
                              ? ` — ${purchaseAvailability(item).label}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {chosenPurchase && (
                      <div className="service-aircon-selected" role="status">
                        <p>
                          <strong>Aircon details:</strong>{" "}
                          {chosenPurchase.brand} {chosenPurchase.model} ·{" "}
                          {chosenPurchase.horsepower} HP
                        </p>
                        <p>
                          <strong>Order status:</strong>{" "}
                          {chosenPurchase.orderStatus || "See My Orders"}
                        </p>
                        <p>
                          <strong>Service availability:</strong>{" "}
                          {chosenAvailability.label}
                        </p>
                        {chosenAvailability.message && (
                          <p>{chosenAvailability.message}</p>
                        )}
                        {isInstallation && !purchaseCanBook && (
                          <button
                            type="button"
                            className="btn btn-soft"
                            onClick={() => navigate("/account/orders")}
                          >
                            View My Orders
                          </button>
                        )}
                      </div>
                    )}
                    {!loadingPurchases && displayedPurchases.length === 0 && (
                      <p className="service-aircon-hint" role="status">
                        {isInstallation
                          ? "No purchases are linked to this customer account. If you already have an aircon from another source, choose ‘I already own an aircon’."
                          : "No delivered purchases are available. You can still enter the details of an aircon you own."}
                      </p>
                    )}
                    {purchaseError && (
                      <p className="service-aircon-hint" role="status">
                        {purchaseError}
                      </p>
                    )}
                  </>
                )}

                {form.airconSource === "CUSTOMER_OWNED" && (
                  <div className="service-aircon-inputs">
                    <label>
                      Aircon brand
                      <input
                        className="form-control"
                        value={form.airconBrand}
                        maxLength={100}
                        placeholder="e.g. Carrier"
                        onChange={(event) =>
                          set("airconBrand", event.target.value)
                        }
                        required
                        disabled={submitting}
                      />
                    </label>
                    <label>
                      Model
                      <input
                        className="form-control"
                        value={form.airconModel}
                        maxLength={150}
                        placeholder="e.g. Aura Inverter"
                        onChange={(event) =>
                          set("airconModel", event.target.value)
                        }
                        required
                        disabled={submitting}
                      />
                    </label>
                    <label>
                      Horsepower (HP)
                      <input
                        className="form-control"
                        type="number"
                        min="0.5"
                        max="20"
                        step="0.1"
                        value={form.airconHp}
                        onChange={(event) =>
                          set("airconHp", event.target.value)
                        }
                        required
                        disabled={submitting}
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              {form.airconSource !== "SHOP" && (
                <>
                  <div className="full">
                    <AvailabilityPicker
                      value={
                        form.date && form.time
                          ? `${form.date}T${form.time}`
                          : ""
                      }
                      onChange={(selected) =>
                        setForm((current) => ({
                          ...current,
                          date: selected.slice(0, 10),
                          time: selected.slice(11, 16),
                        }))
                      }
                      disabled={submitting}
                      label="Choose an available service appointment"
                    />
                  </div>
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
                </>
              )}
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
              {form.airconSource !== "SHOP" && (
                <button
                  type="submit"
                  className="btn btn-dark"
                  disabled={
                    submitting ||
                    !validServiceType ||
                    (form.airconSource === "PURCHASED" &&
                      Boolean(chosenPurchase) &&
                      !purchaseCanBook)
                  }
                >
                  <CalendarDays size={16} />
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
