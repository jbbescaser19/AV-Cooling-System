import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MapPin,
  RefreshCw,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import api from "../../../api/api.js";
import { previewServiceQuote } from "../../utils/serviceQuotation.js";
import AvailabilityPicker from "../scheduling/AvailabilityPicker.jsx";
import TechnicianTeamPicker from "./TechnicianTeamPicker.jsx";
import ReturningCustomerSearch from "./ReturningCustomerSearch.jsx";
import ActionGuidance from "../common/ActionGuidance.jsx";
import { getStaff } from "../../utils/authMock.js";
import "../../styles/management/pos-enhancements.css";
import "../../styles/management/pos-relocation.css";
import "../../styles/management/pos-customer-fees.css";

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

export default function POSWalkInService() {
  const requestKey = useRef(crypto.randomUUID());
  const canAssign = ["OWNER", "MANAGER"].includes(getStaff()?.role);

  const [services, setServices] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [additionalFee, setAdditionalFee] = useState("0");
  const [additionalFeeReason, setAdditionalFeeReason] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [concern, setConcern] = useState("");
  const [airconBrand, setAirconBrand] = useState("");
  const [airconModel, setAirconModel] = useState("");
  const [airconHorsepower, setAirconHorsepower] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);
  const [copperFeet, setCopperFeet] = useState("10");
  const [includeDismantling, setIncludeDismantling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .get("/api/management/sales/walk-in-services", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setServices(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Could not load active services.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refresh]);

  const selected = services.find(
    (service) => String(service.id) === serviceTypeId,
  );

  const isRelocation = selected?.code === "relocation";

  const quotedPrice = selected
    ? previewServiceQuote(
        selected.code,
        selected.price,
        Number(copperFeet),
        includeDismantling,
      )
    : null;

  const fee = Number(additionalFee) || 0;
  const feeValid =
    Number.isFinite(Number(additionalFee)) &&
    fee >= 0 &&
    fee <= 99999.99 &&
    (fee === 0
      ? !additionalFeeReason.trim()
      : additionalFeeReason.trim().length >= 5);
  const phoneValid =
    (customerPhone.match(/\d/g) || []).length >= 7 &&
    /^[+0-9()\s-]+$/.test(customerPhone.trim());
  const bookingTotal =
    quotedPrice === null
      ? null
      : Math.round((Number(quotedPrice) + fee) * 100) / 100;

  const bookingReasons = [
    loading ? "Active services are still loading." : null,
    !selected ? "Choose the service requested by the customer." : null,
    customerName.trim().length < 2
      ? "Enter or select the customer's name."
      : null,
    !phoneValid ? "Enter a valid contact number to reach the customer." : null,
    serviceAddress.trim().length < 5 ? "Enter the service address." : null,
    isRelocation &&
    (destinationAddress.trim().length < 5 ||
      destinationAddress.trim().toLowerCase() ===
        serviceAddress.trim().toLowerCase())
      ? "Enter a different destination address for relocation."
      : null,
    !scheduledStart ? "Choose an available appointment." : null,
    !feeValid
      ? "Enter a valid extra fee and reason, or leave both at zero/empty."
      : null,
  ].filter(Boolean);

  async function book(event) {
    event.preventDefault();
    if (
      saving ||
      loading ||
      !selected ||
      !scheduledStart ||
      quotedPrice === null ||
      !phoneValid ||
      !feeValid ||
      (isRelocation &&
        (destinationAddress.trim().length < 5 ||
          destinationAddress.trim() === serviceAddress.trim()))
    )
      return;

    if (
      !window.confirm(
        `Book ${selected.name} for ${customerName.trim()}? Payment will remain pending.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSaved(null);

    try {
      const { data } = await api.post(
        "/api/management/sales/walk-in-services",
        {
          requestKey: requestKey.current,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          serviceTypeId: Number(serviceTypeId),
          additionalFee: Math.round(fee * 100) / 100,
          additionalFeeReason: additionalFeeReason.trim(),
          serviceAddress: serviceAddress.trim(),
          destinationAddress: isRelocation ? destinationAddress.trim() : "",
          scheduledStart,
          concern: concern.trim(),
          airconBrand: airconBrand.trim(),
          airconModel: airconModel.trim(),
          airconHorsepower: airconHorsepower ? Number(airconHorsepower) : null,
          technicianIds: canAssign ? technicianIds : [],
          copperFeet:
            selected.code === "reinstallation" ? Number(copperFeet) : 10,
          includeDismantling:
            selected.code === "reinstallation" && includeDismantling,
        },
      );

      if (!data.success || !data.booking) {
        throw new Error("Booking was not confirmed.");
      }

      setSaved(data.booking);
      requestKey.current = crypto.randomUUID();
      setCustomerName("");
      setCustomerPhone("");
      setAdditionalFee("0");
      setAdditionalFeeReason("");
      setServiceTypeId("");
      setServiceAddress("");
      setDestinationAddress("");
      setScheduledStart("");
      setConcern("");
      setAirconBrand("");
      setAirconModel("");
      setAirconHorsepower("");
      setTechnicianIds([]);
      setCopperFeet("10");
      setIncludeDismantling(false);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Booking failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sales-ui pos-walkin-page">
      <header className="sales-hero pos-walkin-hero">
        <div>
          <span className="sales-kicker">
            <Wrench size={16} /> WALK-IN SERVICE
          </span>
          <h1>Book a walk-in service</h1>
          <p>
            Register the customer, choose a service, and reserve an
            appointment—all in one place.
          </p>
        </div>
        <button
          type="button"
          className="sales-refresh"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading || saving}
        >
          <RefreshCw size={16} /> Refresh services
        </button>
      </header>

      {error && (
        <p className="sales-error pos-walkin-alert" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <section className="sales-panel pos-walkin-success" role="status">
          <div className="pos-walkin-success__icon">
            <CheckCircle2 size={23} />
          </div>
          <div className="pos-walkin-success__content">
            <strong>Service #{saved.id} booked successfully</strong>
            <p>
              {saved.customer} · {saved.service} ·{" "}
              {String(saved.scheduledStart || "").replace("T", " at ")}
            </p>
            <p>
              Total service price: {money(saved.price)} · Payment:{" "}
              <strong>{saved.paymentStatus || "PENDING"}</strong> · Team:{" "}
              {String(saved.assignment || "PENDING_ASSIGNMENT").replaceAll(
                "_",
                " ",
              )}
            </p>
            {Number(saved.additionalFee) > 0 && (
              <p>
                <strong>Additional fee:</strong> {money(saved.additionalFee)} ·{" "}
                {saved.additionalFeeReason}
              </p>
            )}
            {saved.destinationAddress && (
              <p>
                <strong>Pickup:</strong> {saved.pickupAddress || "—"} ·{" "}
                <strong>Destination:</strong> {saved.destinationAddress}
              </p>
            )}
            {canAssign ? (
              <Link to={`/management/service-requests?requestId=${saved.id}`}>
                Open in Service Requests
              </Link>
            ) : (
              <p>
                Saved for Manager review. Management will handle technician
                assignment, service progress, and payment confirmation.
              </p>
            )}
          </div>
        </section>
      )}

      <form className="pos-walkin-form" onSubmit={book}>
        <div className="pos-walkin-layout">
          <div className="pos-walkin-main">
            <section className="pos-walkin-card">
              <div className="pos-walkin-section-heading">
                <span className="pos-walkin-section-icon">
                  <UserRound size={19} />
                </span>
                <div>
                  <h2>Customer information</h2>
                  <p>Contact details for this walk-in request.</p>
                </div>
              </div>
              <ReturningCustomerSearch
                disabled={saving}
                onSelect={(person) => {
                  setCustomerName(person.name);
                  setCustomerPhone(person.phone);
                  if (person.address) setServiceAddress(person.address);
                }}
              />
              <div className="pos-walkin-fields pos-walkin-fields--two">
                <label className="pos-walkin-field">
                  Customer name <span className="pos-walkin-required">*</span>
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete="name"
                    placeholder="Enter full name"
                    value={customerName}
                    disabled={saving}
                    onChange={(event) => setCustomerName(event.target.value)}
                  />
                </label>
                <label className="pos-walkin-field">
                  Contact number <span className="pos-walkin-required">*</span>
                  <input
                    required
                    minLength={7}
                    maxLength={30}
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. 09XXXXXXXXX"
                    value={customerPhone}
                    disabled={saving}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="pos-walkin-card">
              <div className="pos-walkin-section-heading">
                <span className="pos-walkin-section-icon">
                  <Wrench size={19} />
                </span>
                <div>
                  <h2>Service and aircon details</h2>
                  <p>Choose the service and identify the unit when known.</p>
                </div>
              </div>
              <div className="pos-walkin-fields pos-walkin-fields--two">
                <label className="pos-walkin-field pos-walkin-field--full">
                  Service type <span className="pos-walkin-required">*</span>
                  <select
                    required
                    value={serviceTypeId}
                    disabled={loading || saving}
                    onChange={(event) => {
                      setServiceTypeId(event.target.value);
                      setDestinationAddress("");
                    }}
                  >
                    <option value="">
                      {loading
                        ? "Loading services…"
                        : "Select cleaning, repair, or another service"}
                    </option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {money(service.price)}
                      </option>
                    ))}
                  </select>
                </label>
                {selected?.code === "reinstallation" && (
                  <div
                    className="pos-walkin-field pos-walkin-field--full"
                    style={{ display: "grid", gap: 12 }}
                  >
                    <label className="pos-walkin-field">
                      Total copper pipe length (feet) · first 10 ft included
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        required
                        value={copperFeet}
                        disabled={saving}
                        onChange={(event) => setCopperFeet(event.target.value)}
                      />
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={includeDismantling}
                        disabled={saving}
                        onChange={(event) =>
                          setIncludeDismantling(event.target.checked)
                        }
                        style={{ width: 18, height: 18, flex: "0 0 auto" }}
                      />
                      Include dismantling (+ ₱2,000)
                    </label>
                    <small>
                      Reinstallation: ₱5,000 up to 10 ft, then ₱450 per
                      additional full foot.
                    </small>
                  </div>
                )}
                <label className="pos-walkin-field">
                  Aircon brand{" "}
                  <span className="pos-walkin-optional">Optional</span>
                  <input
                    maxLength={100}
                    placeholder="e.g. Carrier"
                    value={airconBrand}
                    disabled={saving}
                    onChange={(event) => setAirconBrand(event.target.value)}
                  />
                </label>
                <label className="pos-walkin-field">
                  Aircon model{" "}
                  <span className="pos-walkin-optional">Optional</span>
                  <input
                    maxLength={150}
                    placeholder="e.g. Inverter model"
                    value={airconModel}
                    disabled={saving}
                    onChange={(event) => setAirconModel(event.target.value)}
                  />
                </label>
                <label className="pos-walkin-field">
                  Horsepower (HP){" "}
                  <span className="pos-walkin-optional">Optional</span>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.1"
                    placeholder="e.g. 1.5"
                    value={airconHorsepower}
                    disabled={saving}
                    onChange={(event) =>
                      setAirconHorsepower(event.target.value)
                    }
                  />
                </label>
              </div>
              {!loading && services.length === 0 && (
                <p className="sales-error" role="status">
                  No active service types found. An Owner or Manager can enable
                  services under Service Types.
                </p>
              )}
            </section>

            <section className="pos-walkin-card">
              <div className="pos-walkin-section-heading">
                <span className="pos-walkin-section-icon">
                  <MapPin size={19} />
                </span>
                <div>
                  <h2>Service location and request</h2>
                  <p>Where technicians will go and what the customer needs.</p>
                </div>
              </div>
              <div className="pos-walkin-fields">
                <label className="pos-walkin-field">
                  {isRelocation
                    ? "Pickup address (current location)"
                    : "Service address"}{" "}
                  <span className="pos-walkin-required">*</span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={2}
                    placeholder={
                      isRelocation
                        ? "Where the aircon will be collected"
                        : "House/Unit, Street, Barangay, City, Province"
                    }
                    value={serviceAddress}
                    disabled={saving}
                    onChange={(event) => setServiceAddress(event.target.value)}
                  />
                </label>
                {isRelocation && (
                  <>
                    <label className="pos-walkin-field">
                      Destination address (new location){" "}
                      <span className="pos-walkin-required">*</span>
                      <textarea
                        required
                        minLength={5}
                        maxLength={2000}
                        rows={2}
                        placeholder="Where the aircon will be installed after relocation"
                        value={destinationAddress}
                        disabled={saving}
                        onChange={(event) =>
                          setDestinationAddress(event.target.value)
                        }
                      />
                    </label>
                    <p className="pos-walkin-location-help">
                      Please confirm both addresses with the customer before
                      booking. The technician needs the pickup and the
                      installation destination.
                    </p>
                  </>
                )}
                <label className="pos-walkin-field">
                  Customer concern / request{" "}
                  <span className="pos-walkin-optional">Optional</span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    placeholder="Describe the issue or requested work"
                    value={concern}
                    disabled={saving}
                    onChange={(event) => setConcern(event.target.value)}
                  />
                </label>
              </div>
            </section>
          </div>

          <aside
            className="pos-walkin-side"
            aria-label="Appointment and booking summary"
          >
            <section className="pos-walkin-card">
              <div className="pos-walkin-section-heading">
                <span className="pos-walkin-section-icon">
                  <CalendarCheck size={19} />
                </span>
                <div>
                  <h2>Appointment</h2>
                  <p>Choose an available date and time.</p>
                </div>
              </div>
              <div className="pos-walkin-schedule">
                <AvailabilityPicker
                  label="Available service date and time"
                  value={scheduledStart}
                  onChange={setScheduledStart}
                  disabled={saving}
                />
              </div>
            </section>

            {canAssign && (
              <section className="pos-walkin-card pos-walkin-team-card">
                <div className="pos-walkin-section-heading">
                  <span className="pos-walkin-section-icon">
                    <Users size={19} />
                  </span>
                  <div>
                    <h2>Technician assignment</h2>
                    <p>Select the assigned team if already known.</p>
                  </div>
                </div>
                <div className="pos-walkin-team">
                  <TechnicianTeamPicker
                    value={technicianIds}
                    onChange={setTechnicianIds}
                    disabled={saving}
                  />
                </div>
              </section>
            )}

            <section className="pos-walkin-card pos-walkin-summary">
              <div className="pos-walkin-section-heading">
                <span className="pos-walkin-section-icon">
                  <ClipboardList size={19} />
                </span>
                <div>
                  <h2>Booking summary</h2>
                  <p>Review before confirming.</p>
                </div>
              </div>

              <div className="pos-walkin-summary-row">
                <span>Selected service</span>
                <strong>{selected?.name || "Not selected"}</strong>
              </div>
              {isRelocation && (
                <>
                  <div className="pos-walkin-summary-row pos-walkin-address-row">
                    <span>Pickup from</span>
                    <strong>{serviceAddress.trim() || "Not entered"}</strong>
                  </div>
                  <div className="pos-walkin-summary-row pos-walkin-address-row">
                    <span>Install at</span>
                    <strong>
                      {destinationAddress.trim() || "Not entered"}
                    </strong>
                  </div>
                </>
              )}
              <div className="pos-walkin-summary-row">
                <span>Service price before extra fee</span>
                <strong>
                  {quotedPrice === null ? "—" : money(quotedPrice)}
                </strong>
              </div>
              <div className="pos-fee-fields">
                <div className="pos-fee-fields__heading">
                  <strong>Additional fee (optional)</strong>
                  <small>
                    Use for extra travel or agreed special work. Explain it to
                    the customer.
                  </small>
                </div>
                <label>
                  Additional fee (₱)
                  <input
                    type="number"
                    min="0"
                    max="99999.99"
                    step="0.01"
                    value={additionalFee}
                    disabled={saving}
                    onChange={(event) => {
                      setAdditionalFee(event.target.value);
                      if (Number(event.target.value) <= 0)
                        setAdditionalFeeReason("");
                    }}
                  />
                </label>
                {fee > 0 && (
                  <label>
                    Reason for extra fee (required)
                    <input
                      type="text"
                      required
                      minLength={5}
                      maxLength={255}
                      value={additionalFeeReason}
                      disabled={saving}
                      placeholder="e.g. Extra travel to a remote address"
                      onChange={(event) =>
                        setAdditionalFeeReason(event.target.value)
                      }
                    />
                  </label>
                )}
                {!feeValid && (
                  <p className="pos-fee-fields__error">
                    Enter a valid fee and a reason (5+ characters), or leave
                    both empty/zero.
                  </p>
                )}
              </div>
              {fee > 0 && feeValid && (
                <div className="pos-walkin-summary-row pos-fee-summary">
                  <span>Additional fee · {additionalFeeReason.trim()}</span>
                  <strong>{money(fee)}</strong>
                </div>
              )}
              <div className="pos-walkin-summary-row">
                <span>Total booking amount</span>
                <strong>
                  {bookingTotal === null ? "—" : money(bookingTotal)}
                </strong>
              </div>
              <div className="pos-walkin-summary-row">
                <span>Payment method</span>
                <strong>Cash</strong>
              </div>
              <div className="pos-walkin-summary-row">
                <span>Payment status</span>
                <span className="pos-walkin-pending">
                  <CreditCard size={14} /> Pending
                </span>
              </div>
              <p className="pos-walkin-payment-note">
                Booking does not mark the service as paid. Payment is recorded
                only after staff verify collection. Final charges may change
                after assessment.
              </p>
              <ActionGuidance
                title="Complete these before booking"
                reasons={bookingReasons}
                readyText="Ready to save the booking. Payment will remain pending."
              />
              <button
                className="pos-book-submit"
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  !selected ||
                  !scheduledStart ||
                  !phoneValid ||
                  !feeValid ||
                  (isRelocation &&
                    (destinationAddress.trim().length < 5 ||
                      destinationAddress.trim() === serviceAddress.trim()))
                }
              >
                <CalendarCheck size={18} />
                {saving ? "Booking…" : "Confirm service booking"}
              </button>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}
