import { useMemo, useState } from "react";
import { Plus, Search, Users, UserPlus, X, Eye, EyeOff } from "lucide-react";

import "../../styles/management/staff-accounts.css";

const initialStaff = [
  {
    id: 1,
    name: "Maria Santos",
    email: "maria@avcooling.com",
    role: "MANAGER",
    status: "Active",
  },
  {
    id: 2,
    name: "John Reyes",
    email: "john@avcooling.com",
    role: "SALES_CASHIER",
    status: "Active",
  },
];

export default function StaffAccountsPage() {
  const [staff, setStaff] = useState(initialStaff);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "SALES_CASHIER",
    password: "",
  });

  const filteredStaff = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return staff;

    return staff.filter((user) =>
      `${user.name} ${user.email} ${user.role} ${user.status}`
        .toLowerCase()
        .includes(query),
    );
  }, [staff, search]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreate = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      return;
    }

    /*
      FRONTEND PROTOTYPE ONLY.

      Do NOT store the password in localStorage.

      Later replace this section with:

      POST /api/staff

      The backend will hash the password using bcrypt
      before saving it to MySQL.
    */

    const newStaff = {
      id: Date.now(),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      status: "Active",
    };

    setStaff((current) => [newStaff, ...current]);

    setForm({
      name: "",
      email: "",
      role: "SALES_CASHIER",
      password: "",
    });

    setShowPassword(false);
    setOpen(false);
  };

  const toggleStatus = (id) => {
    setStaff((current) =>
      current.map((user) =>
        user.id === id
          ? {
              ...user,
              status: user.status === "Active" ? "Inactive" : "Active",
            }
          : user,
      ),
    );
  };

  const formatRole = (role) => {
    if (role === "SALES_CASHIER") {
      return "Sales / Cashier";
    }

    if (role === "MANAGER") {
      return "Manager";
    }

    return role;
  };

  return (
    <div className="staff-page">
      {/* HEADER */}

      <div className="staff-page-header">
        <div>
          <p className="staff-eyebrow">User Management</p>

          <h1>Staff Accounts</h1>

          <p>
            Create and manage employee access to the AV Cooling management
            system.
          </p>
        </div>

        <button
          type="button"
          className="staff-primary-btn"
          onClick={() => setOpen(true)}
        >
          <UserPlus size={18} />
          Create Staff Account
        </button>
      </div>

      {/* STATS */}

      <div className="staff-stats">
        <div className="staff-stat-card">
          <span className="staff-stat-icon">
            <Users size={20} />
          </span>

          <div>
            <small>Total Staff</small>
            <strong>{staff.length}</strong>
          </div>
        </div>

        <div className="staff-stat-card">
          <span className="staff-stat-icon">
            <Users size={20} />
          </span>

          <div>
            <small>Active Accounts</small>

            <strong>
              {staff.filter((user) => user.status === "Active").length}
            </strong>
          </div>
        </div>

        <div className="staff-stat-card">
          <span className="staff-stat-icon">
            <Users size={20} />
          </span>

          <div>
            <small>Managers</small>

            <strong>
              {staff.filter((user) => user.role === "MANAGER").length}
            </strong>
          </div>
        </div>
      </div>

      {/* SEARCH */}

      <div className="staff-toolbar">
        <label className="staff-search">
          <Search size={18} />

          <input
            type="search"
            placeholder="Search staff..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {/* TABLE */}

      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredStaff.map((user) => (
              <tr key={user.id}>
                <td data-label="Staff">
                  <div className="staff-user">
                    <span className="staff-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </span>

                    <div>
                      <strong>{user.name}</strong>

                      <small>{user.email}</small>
                    </div>
                  </div>
                </td>

                <td data-label="Role">
                  <span className="staff-role">{formatRole(user.role)}</span>
                </td>

                <td data-label="Status">
                  <span
                    className={`staff-status ${
                      user.status === "Active" ? "active" : "inactive"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>

                <td data-label="Action">
                  <button
                    type="button"
                    className="staff-action-btn"
                    onClick={() => toggleStatus(user.id)}
                  >
                    {user.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}

            {!filteredStaff.length && (
              <tr>
                <td colSpan="4" className="staff-empty">
                  No staff accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE STAFF MODAL */}

      {open && (
        <div
          className="staff-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            className="staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-staff-title"
          >
            <div className="staff-modal-header">
              <div>
                <p className="staff-eyebrow">New Account</p>

                <h2 id="create-staff-title">Create Staff Account</h2>
              </div>

              <button
                type="button"
                className="staff-close-btn"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="staff-form" onSubmit={handleCreate}>
              <label>
                <span>Full Name</span>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </label>

              <label>
                <span>Email Address</span>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="juan@avcooling.com"
                  required
                />
              </label>

              <label>
                <span>Role</span>

                <select name="role" value={form.role} onChange={handleChange}>
                  <option value="SALES_CASHIER">Sales / Cashier</option>

                  <option value="MANAGER">Manager</option>
                </select>
              </label>

              <label>
                <span>Temporary Password</span>

                <div className="staff-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    minLength="8"
                    placeholder="Minimum 8 characters"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="staff-security-note">
                Passwords will be securely hashed by the backend using bcrypt
                before being stored in MySQL.
              </div>

              <div className="staff-form-actions">
                <button
                  type="button"
                  className="staff-cancel-btn"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="staff-primary-btn">
                  <Plus size={17} />
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
