import { useNavigate } from "react-router-dom";
import { Building2, LogIn, ShieldCheck } from "lucide-react";

import { loginStaff } from "../../utils/authMock";

import "../../styles/auth/auth.css";

export default function ManagementLoginPage() {
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const username = String(formData.get("username") || "").trim();

    const role = String(formData.get("role") || "OWNER");

    const staff = {
      id: `staff-${Date.now()}`,

      name: username || getRoleName(role),

      username: username || role.toLowerCase(),

      role,
    };

    loginStaff(staff);

    navigate("/management/dashboard", {
      replace: true,
    });
  };

  return (
    <div className="auth-shell mgmt-login">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div
          className="eyebrow"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ShieldCheck size={16} />
          Management Login
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <Building2 size={28} />

          <h1
            style={{
              margin: 0,
            }}
          >
            AV Cooling Staff
          </h1>
        </div>

        <p className="muted">
          Sign in to access the AV Cooling management system.
        </p>

        <div className="form-group">
          <label htmlFor="management-username">Username</label>

          <input
            id="management-username"
            className="form-control"
            name="username"
            type="text"
            placeholder="Enter username"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="management-password">Password</label>

          <input
            id="management-password"
            className="form-control"
            name="password"
            type="password"
            placeholder="Enter password"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="management-role">Role</label>

          <select
            id="management-role"
            name="role"
            className="form-control"
            defaultValue="OWNER"
          >
            <option value="OWNER">Owner</option>

            <option value="MANAGER">Manager</option>

            <option value="SALES_CASHIER">Sales / Cashier</option>

            <option value="TECHNICIAN">Technician</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary">
          <LogIn size={17} />
          Login
        </button>
      </form>
    </div>
  );
}

function getRoleName(role) {
  switch (role) {
    case "OWNER":
      return "Owner";

    case "MANAGER":
      return "Manager";

    case "SALES_CASHIER":
      return "Sales / Cashier";

    case "TECHNICIAN":
      return "Technician";

    default:
      return "Staff";
  }
}
