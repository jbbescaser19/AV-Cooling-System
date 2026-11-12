import { NavLink } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Bell,
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  ContactRound,
  CreditCard,
  History,
  LayoutDashboard,
  MessageCircle,
  MessageSquareText,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { readStaff } from "../../utils/authMock";
import "../../styles/management/sidebar.css";

const nav = [
  {
    label: "",
    items: [
      [
        "Dashboard",
        "/management/dashboard",
        LayoutDashboard,
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],
      ["Archive", "/management/archive", Archive, ["OWNER", "MANAGER"]],
    ],
  },
  {
    label: "Sales",
    items: [
      [
        "POS",
        "/management/pos",
        ShoppingCart,
        ["OWNER", "MANAGER", "SALES_CASHIER"],
      ],
      ["Orders", "/management/orders", ClipboardList, ["OWNER", "MANAGER"]],
      [
        "Completed Jobs History",
        "/management/installation-history",
        History,
        ["OWNER", "MANAGER"],
      ],
      ["Payments", "/management/payments", CreditCard, ["OWNER", "MANAGER"]],
    ],
  },
  {
    label: "Catalog",
    items: [
      ["Products", "/management/products", Package, ["OWNER", "MANAGER"]],
      [
        "Product Categories",
        "/management/categories",
        Package,
        ["OWNER", "MANAGER"],
      ],
      [
        "Product Variants",
        "/management/variants",
        Package,
        ["OWNER", "MANAGER"],
      ],
      ["Inventory", "/management/inventory", Boxes, ["OWNER", "MANAGER"]],
      [
        "Stock Movements",
        "/management/stock-movements",
        History,
        ["OWNER", "MANAGER"],
      ],
    ],
  },
  {
    label: "Tools",
    items: [
      [
        "Capacity Calculator",
        "/management/capacity-calculator",
        Calculator,
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],
    ],
  },
  {
    label: "Services",
    items: [
      [
        "Service Types",
        "/management/service-types",
        Wrench,
        ["OWNER", "MANAGER"],
      ],
      [
        "Service Requests",
        "/management/service-requests",
        ReceiptText,
        ["OWNER", "MANAGER"],
      ],
      ["Technicians", "/management/technicians", Users, ["OWNER", "MANAGER"]],
      [
        "Booking Calendar",
        "/management/booking-calendar",
        CalendarDays,
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],
      [
        "Schedules",
        "/management/schedules",
        CalendarDays,
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],
    ],
  },
  {
    label: "Customers",
    items: [
      [
        "Customers",
        "/management/customers",
        ContactRound,
        ["OWNER", "MANAGER"],
      ],
      [
        "Feedback & Sentiment",
        "/management/feedback",
        MessageSquareText,
        ["OWNER", "MANAGER"],
      ],
    ],
  },
  {
    label: "Operations",
    items: [
      [
        "Facebook Requests",
        "/management/facebook-requests",
        MessageCircle,
        ["OWNER", "MANAGER"],
      ],
      ["Reports", "/management/reports", BarChart3, ["OWNER", "MANAGER"]],
      [
        "Notifications",
        "/management/notifications",
        Bell,
        ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"],
      ],
    ],
  },
  {
    label: "Administration",
    items: [
      ["Staff Accounts", "/management/staff", UserCog, ["OWNER"]],
      ["Audit Logs", "/management/audit-logs", ShieldCheck, ["OWNER"]],
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const staff = readStaff();

  return (
    <aside className={`mgmt-sidebar ${open ? "open" : ""}`}>
      <div className="mgmt-brand">
        <div className="mgmt-brand-info">
          <span className="mgmt-brand-logo">AV</span>
          <div>
            <strong>AV Cooling</strong>
            <small>Management</small>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close navigation"
          title="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="side-scroll">
        {nav.map((group) => {
          const items = group.items.filter(
            ([, , , roles]) =>
              Array.isArray(roles) && roles.includes(staff?.role),
          );

          if (!items.length) return null;

          return (
            <div className="side-group" key={group.label || "main"}>
              {group.label && <div className="side-label">{group.label}</div>}

              {items.map(([label, path, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
