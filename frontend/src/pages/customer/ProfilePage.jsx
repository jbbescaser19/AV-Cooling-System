import { useState } from "react";
import { UserRound } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import { loadMock, saveMock } from "../../utils/prototypeStore";

export default function ProfilePage({ customer }) {
  const saved = loadMock("av_customer_profile", {
    name: customer.name,
    email: customer.email,
    phone: "0917 000 0000",
    status: "Active",
  });

  const [form, setForm] = useState(saved);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const saveProfile = () => {
    saveMock("av_customer_profile", form);
    window.alert("Profile saved.");
  };

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={UserRound}
        title="Profile"
        copy="Customer information used for orders and service bookings."
      />

      <section className="surface customer-profile-grid">
        <label>
          Full name
          <input
            className="form-control"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>

        <label>
          Email
          <input
            className="form-control"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>

        <label>
          Phone
          <input
            className="form-control"
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </label>

        <label>
          Account status
          <input className="form-control" value={form.status} readOnly />
        </label>

        <button type="button" className="btn btn-dark" onClick={saveProfile}>
          Save Profile
        </button>
      </section>
    </div>
  );
}
