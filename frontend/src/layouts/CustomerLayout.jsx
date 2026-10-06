import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";

import {
  User,
  Package,
  CalendarDays,
  CreditCard,
  Bell,
  MessageSquare,
  MapPin,
  Lock,
  Home,
  LogOut,
} from "lucide-react";

import { logoutCustomer } from "../utils/authMock";

import "../styles/customer/customer.css";

const items = [
  ["profile", User, "Profile"],
  ["orders", Package, "Orders"],
  ["services", CalendarDays, "Services"],
  ["payments", CreditCard, "Payments"],
  ["notifications", Bell, "Notifications"],
  ["feedback", MessageSquare, "Feedback"],
  ["addresses", MapPin, "Addresses"],
  ["change-password", Lock, "Password"],
];

export default function CustomerLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutCustomer();

    navigate("/", {
      replace: true,
    });
  };

  return (
    <div className="customer-shell">
      <aside className="customer-side">
        <Link to="/" className="customer-home">
          <Home size={18} />

          <span>AV Cooling</span>
        </Link>

        <h2>My Account</h2>

        <nav aria-label="Customer account navigation">
          {items.map(([path, Icon, label]) => (
            <NavLink key={path} to={path}>
              <Icon size={18} />

              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="customer-logout"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log Out"
        >
          <LogOut size={18} />

          <span>Log Out</span>
        </button>
      </aside>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
