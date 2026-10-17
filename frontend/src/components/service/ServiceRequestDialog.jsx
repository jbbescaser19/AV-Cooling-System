import { useEffect, useState } from "react";

import { CalendarDays, X } from "lucide-react";

import SavedAddressSelector from "../common/SavedAddressSelector";

import { getCustomer } from "../../utils/authMock";

import { getDefaultCustomerAddress } from "../../utils/addressStore";

import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

import "../../styles/ecommerce/pages.css";

export default function ServiceRequestDialog({ service, onClose }) {
  const customer = getCustomer();

  const defaultAddress = getDefaultCustomerAddress();

  const isRelocation = service.id === "relocation";

  const [form, setForm] = useState({
    date: "",
    time: "09:00",

    address: defaultAddress?.address || "",

    destinationAddress: "",

    concern: "",
    notes: "",
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = (event) => {
    event.preventDefault();

    if (!form.date) {
      alert("Please select a preferred date.");

      return;
    }

    if (!form.address.trim()) {
      alert(
        isRelocation
          ? "Please select the current unit address."
          : "Please select or add a service address.",
      );

      return;
    }

    if (isRelocation && !form.destinationAddress.trim()) {
      alert("Please enter the relocation destination address.");

      return;
    }

    const items = loadMock("av_customer_services", []);

    const record = {
      id: uid("SR"),

      serviceId: service.id,

      service: service.name,

      schedule: `${form.date} · ${form.time}`,

      address: form.address,

      destinationAddress: isRelocation ? form.destinationAddress : "",

      concern: form.concern,

      notes: form.notes,

      status: "Pending Approval",

      customer: customer?.name || "Customer",
    };

    saveMock("av_customer_services", [record, ...items]);

    alert(`Service request ${record.id} submitted.`);

    onClose();
  };

  return (
    <div
      className="service-booking-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="service-booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Request ${service.name}`}
      >
        <form onSubmit={submit}>
          <div className="service-booking-head">
            <div>
              <span>
                {isRelocation ? "Relocation Request" : "Service Request"}
              </span>

              <h2>{service.name}</h2>
            </div>

            <button type="button" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="service-booking-grid">
            <label>
              Preferred date
              <input
                className="form-control"
                type="date"
                value={form.date}
                onChange={(event) => set("date", event.target.value)}
                required
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
              />
            </label>

            <SavedAddressSelector
              className="full"
              title={isRelocation ? "Current unit address" : "Service address"}
              value={form.address}
              onChange={(address) => set("address", address)}
            />

            {isRelocation && (
              <label className="full">
                Relocation destination
                <textarea
                  className="form-control"
                  rows="3"
                  value={form.destinationAddress}
                  onChange={(event) =>
                    set("destinationAddress", event.target.value)
                  }
                  placeholder="House/Unit, Street, Barangay, City, Province"
                  required
                />
              </label>
            )}

            <label className="full">
              {isRelocation ? "Relocation details" : "Concern"}

              <textarea
                className="form-control"
                rows="3"
                value={form.concern}
                onChange={(event) => set("concern", event.target.value)}
                placeholder={
                  isRelocation
                    ? "Example: Move a 1.5HP split-type unit from the bedroom to another house."
                    : "Example: unit is not cooling properly"
                }
              />
            </label>

            <label className="full">
              Notes
              <textarea
                className="form-control"
                rows="2"
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                placeholder={
                  isRelocation
                    ? "Example: second floor unit, outdoor unit mounted outside window"
                    : ""
                }
              />
            </label>
          </div>

          <div className="service-booking-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Cancel
            </button>

            <button type="submit" className="btn btn-dark">
              <CalendarDays size={16} />
              Submit Request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
