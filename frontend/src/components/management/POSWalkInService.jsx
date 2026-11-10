import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, RefreshCw, Wrench } from "lucide-react";
import api from "../../../api/api.js";
import AvailabilityPicker from "../scheduling/AvailabilityPicker.jsx";
import TechnicianTeamPicker from "./TechnicianTeamPicker.jsx";
import { getStaff } from "../../utils/authMock.js";

const peso = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value) || 0,
  );

/** Walk-in requests are bookings, NOT cash receipts. There is no service payment table. */
export default function POSWalkInService() {
  const requestKey = useRef(crypto.randomUUID());
  const [services, setServices] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [concern, setConcern] = useState("");
  const [airconBrand, setAirconBrand] = useState("");
  const [airconModel, setAirconModel] = useState("");
  const [airconHorsepower, setAirconHorsepower] = useState("");
  const [technicianIds, setTechnicianIds] = useState([]);
  const canAssign = ["OWNER", "MANAGER"].includes(getStaff()?.role);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/api/management/sales/walk-in-services", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setServices(data.items || []);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || "Could not load services.");
      });
    return () => controller.abort();
  }, [refresh]);
  const selected = services.find((s) => String(s.id) === serviceTypeId);
  async function book(event) {
    event.preventDefault();
    if (saving || !selected || !scheduledStart) return;
    if (
      !window.confirm(
        `Confirm the ${selected.name} appointment for ${customerName}? No payment will be recorded.`,
      )
    )
      return;
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
          serviceAddress: serviceAddress.trim(),
          scheduledStart,
          concern: concern.trim(),
          airconBrand: airconBrand.trim(),
          airconModel: airconModel.trim(),
          airconHorsepower: airconHorsepower ? Number(airconHorsepower) : null,
          technicianIds: canAssign ? technicianIds : [],
        },
      );
      if (!data.success || !data.booking)
        throw Error("The booking was not confirmed.");
      setSaved(data.booking);
      requestKey.current = crypto.randomUUID();
      setCustomerName("");
      setCustomerPhone("");
      setServiceTypeId("");
      setServiceAddress("");
      setScheduledStart("");
      setConcern("");
      setAirconBrand("");
      setAirconModel("");
      setAirconHorsepower("");
      setTechnicianIds([]);
      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Booking failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="sales-ui">
      <header className="sales-hero">
        <div>
          <span className="sales-kicker">
            <Wrench size={16} /> WALK-IN SERVICE
          </span>
          <h1>Book a service</h1>
          <p>
            Reserve a date, record the customer details, and assign workers now
            or later.
          </p>
        </div>
        <button
          type="button"
          className="sales-refresh"
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={16} /> Refresh services
        </button>
      </header>
      {error && (
        <p className="sales-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <section className="sales-panel" role="status">
          <strong>
            <CalendarCheck size={17} /> Service #{saved.id} booked
          </strong>
          <p>
            {saved.customer} · {saved.service} ·{" "}
            {saved.scheduledStart.replace("T", " at ")}
          </p>
          <p>
            Base price: {peso(saved.price)} · Payment:{" "}
            <strong>Not recorded</strong> · Team:{" "}
            {saved.assignment.replaceAll("_", " ")}
          </p>
          <Link to={`/management/service-requests?requestId=${saved.id}`}>
            View in Service Requests
          </Link>
        </section>
      )}
      <form className="sales-panel pos-walkin-form" onSubmit={book}>
        <h2>Walk-in service details</h2>
        <p className="sales-note">
          This books a service appointment. It does not record a cash payment or
          issue a paid receipt.
        </p>
        <div className="pos-form-grid">
          <label>
            Customer name
            <input
              required
              minLength={2}
              maxLength={150}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>
          <label>
            Contact number
            <input
              required
              minLength={7}
              maxLength={30}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>
          <label>
            Service
            <select
              required
              value={serviceTypeId}
              onChange={(e) => setServiceTypeId(e.target.value)}
            >
              <option value="">Choose service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {peso(s.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer aircon brand (optional)
            <input
              maxLength={100}
              value={airconBrand}
              onChange={(e) => setAirconBrand(e.target.value)}
              placeholder="e.g., Carrier"
            />
          </label>
          <label>
            Aircon model (optional)
            <input
              maxLength={150}
              value={airconModel}
              onChange={(e) => setAirconModel(e.target.value)}
              placeholder="e.g., Aura Inverter"
            />
          </label>
          <label>
            Horsepower (optional)
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={airconHorsepower}
              onChange={(e) => setAirconHorsepower(e.target.value)}
            />
          </label>
        </div>
        <label>
          Service address
          <textarea
            rows={2}
            required
            minLength={5}
            maxLength={2000}
            value={serviceAddress}
            onChange={(e) => setServiceAddress(e.target.value)}
          />
        </label>
        <label>
          Customer concern / request
          <textarea
            rows={3}
            maxLength={1000}
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            placeholder="Describe what the technician should check or do"
          />
        </label>
        <AvailabilityPicker
          label="Service date and time"
          value={scheduledStart}
          onChange={setScheduledStart}
        />
        {canAssign && (
          <TechnicianTeamPicker
            value={technicianIds}
            onChange={setTechnicianIds}
            disabled={saving}
          />
        )}
        {!canAssign && (
          <p className="sales-note">
            A Manager or Owner can assign the technician team later in Service
            Requests.
          </p>
        )}
        {selected && (
          <p className="sales-note">
            Base service price: <strong>{peso(selected.price)}</strong>. Final
            charges may change after inspection.
          </p>
        )}
        <button
          className="sales-refresh pos-book-submit"
          type="submit"
          disabled={saving || !selected || !scheduledStart}
        >
          {saving ? "Booking…" : "Confirm service booking"}
        </button>
      </form>
    </div>
  );
}
