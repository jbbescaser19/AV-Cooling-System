import { useState } from "react";
import { UserRound } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";

export default function ChangePasswordPage() {
  const [done, setDone] = useState(false);

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={UserRound}
        title="Change Password"
        copy="Prototype password update flow."
      />

      <section className="surface customer-form-card">
        <label>
          Current password
          <input
            className="form-control"
            type="password"
            autoComplete="current-password"
          />
        </label>

        <label>
          New password
          <input
            className="form-control"
            type="password"
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm new password
          <input
            className="form-control"
            type="password"
            autoComplete="new-password"
          />
        </label>

        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setDone(true)}
        >
          Update Password
        </button>

        {done && (
          <span className="customer-success-note">
            Password updated in mock mode.
          </span>
        )}
      </section>
    </div>
  );
}
