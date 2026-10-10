import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { CalendarDays, X } from "lucide-react";

import SavedAddressSelector from "../../components/common/SavedAddressSelector";

import { services } from "../../data/services";

import { getCustomer } from "../../utils/authMock";

import { getDefaultCustomerAddress } from "../../utils/addressStore";

import { PENDING_ACTIONS, savePendingAction } from "../../utils/purchaseFlow";

import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

import "../../styles/ecommerce/pages.css";

export default function ServicesPage() {
  const nav = useNavigate();

  const { serviceId } = useParams();

  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    const service = services.find((item) => item.id === serviceId);

    if (!service) {
      return;
    }

    if (!getCustomer()) {
      savePendingAction({
        type: PENDING_ACTIONS.REQUEST_SERVICE,

        serviceId: service.id,
      });

      nav("/login", {
        replace: true,
      });

      return;
    }

    setSelected(service);
  }, [serviceId, nav]);

  const start = (service) => {
    if (!getCustomer()) {
      savePendingAction({
        type: PENDING_ACTIONS.REQUEST_SERVICE,

        serviceId: service.id,
      });

      nav("/login");

      return;
    }

    setSelected(service);
  };

  const closeBooking = () => {
    setSelected(null);

    if (serviceId) {
      nav("/services", {
        replace: true,
      });
    }
  };

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Services</div>

            <h1 className="page-title">Professional aircon service</h1>

            <p className="section-copy">
              Installation, maintenance, repair, troubleshooting, and urgent
              service with a clear request and scheduling process.
            </p>
          </div>
        </div>

        <div className="services-list-grid">
          {services.map((service) => {
            const Icon = service.icon;

            return (
              <article className="surface service-list-card" key={service.id}>
                <Icon size={30} />

                <h2>{service.name}</h2>

                <p>{service.desc}</p>

                <button
                  className="btn btn-dark"
                  type="button"
                  onClick={() => start(service)}
                >
                  Request Service
                </button>
              </article>
            );
          })}
        </div>
      </div>

      {selected && <BookingDialog service={selected} onClose={closeBooking} />}
    </section>
  );
}

function BookingDialog({ service, onClose }) {
  const customer = getCustomer();

  const defaultAddress = getDefaultCustomerAddress();

  const [form, setForm] = useState({
    date: "",
    time: "09:00",

    address: defaultAddress?.address || "",

    concern: "",
    notes: "",
  });

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = () => {
    if (!form.date) {
      alert("Please select a preferred date.");

      return;
    }

    if (!form.address.trim()) {
      alert("Please select or add a service address.");

      return;
    }

    const items = loadMock("av_customer_services", []);

    const record = {
      id: uid("SR"),

      service: service.name,

      schedule: `${form.date} · ${form.time}`,

      address: form.address,

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
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="service-booking-dialog">
        <div className="service-booking-head">
          <div>
            <span>Service Request</span>

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
            />
          </label>

          <label>
            Preferred time
            <input
              className="form-control"
              type="time"
              value={form.time}
              onChange={(event) => set("time", event.target.value)}
            />
          </label>

          <SavedAddressSelector
            className="full"
            title="Service address"
            value={form.address}
            onChange={(address) => set("address", address)}
          />

          <label className="full">
            Concern
            <textarea
              className="form-control"
              rows="3"
              value={form.concern}
              onChange={(event) => set("concern", event.target.value)}
              placeholder="Example: unit is not cooling properly"
            />
          </label>

          <label className="full">
            Notes
            <textarea
              className="form-control"
              rows="2"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </label>
        </div>

        <div className="service-booking-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>

          <button type="button" className="btn btn-dark" onClick={submit}>
            <CalendarDays size={16} />
            Submit Request
          </button>
        </div>
      </section>
    </div>
  );
}
