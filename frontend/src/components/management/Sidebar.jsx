import { NavLink } from "react-router-dom";

import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ClipboardList,
  ContactRound,
  CreditCard,
  History,
  LayoutDashboard,
  MessageCircle,
  MessageSquareText,
  MonitorCog,
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
        ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"],
      ],
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

      [
        "Orders",
        "/management/orders",
        ClipboardList,
        ["OWNER", "MANAGER", "SALES_CASHIER"],
      ],

      [
        "Payments",
        "/management/payments",
        CreditCard,
        ["OWNER", "MANAGER", "SALES_CASHIER"],
      ],
    ],
  },

  {
    label: "Catalog",
    items: [
      [
        "Products",
        "/management/products",
        Package,
        ["OWNER", "MANAGER", "SALES_CASHIER"],
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
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],

      [
        "Work Orders",
        "/management/work-orders",
        ClipboardList,
        ["OWNER", "MANAGER", "TECHNICIAN"],
      ],

      ["Technicians", "/management/technicians", Users, ["OWNER", "MANAGER"]],

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
        ["OWNER", "MANAGER", "SALES_CASHIER"],
      ],
    ],
  },

  {
    label: "Website",
    items: [
      [
        "Website Content",
        "/management/website-content",
        MonitorCog,
        ["OWNER", "MANAGER"],
      ],

      [
        "Feedback",
        "/management/feedback",
        MessageSquareText,
        ["OWNER", "MANAGER"],
      ],

      [
        "Contact Messages",
        "/management/contact-messages",
        MessageSquareText,
        ["OWNER", "MANAGER", "SALES_CASHIER"],
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
        ["OWNER", "MANAGER", "SALES_CASHIER"],
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
      {/* BRAND */}

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

      {/* NAVIGATION */}

      <nav className="side-scroll">
        {nav.map((group) => {
          const items = group.items.filter((item) =>
            item[3].includes(staff?.role),
          );

          if (!items.length) {
            return null;
          }

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
