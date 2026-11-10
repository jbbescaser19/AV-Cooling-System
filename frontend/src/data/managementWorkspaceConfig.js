/** The UI schema controls display only. Validation and permissions live on the backend. */
const text = (key, label, required = true, maxLength = 150) => ({
  key,
  label,
  type: "text",
  required,
  maxLength,
});
const number = (key, label, { min = 0, max = 1000000, step = 1 } = {}) => ({
  key,
  label,
  type: "number",
  min,
  max,
  step,
  required: true,
});
const choice = (key, label, choices) => ({
  key,
  label,
  type: "select",
  choices,
  required: true,
});
const reference = (key, label, optionGroup, nullable = false) => ({
  key,
  label,
  type: "reference",
  optionGroup,
  nullable,
  required: !nullable,
});
const note = (key, label, required = false) => ({
  key,
  label,
  type: "textarea",
  required,
  maxLength: 2000,
});
const date = (key, label, type = "date") => ({
  key,
  label,
  type,
  required: true,
});
const activityStatus = choice("status", "Status", ["ACTIVE", "INACTIVE"]);
export const workspaceConfig = {
  categories: {
    title: "Product Categories",
    description: "Create categories before adding product models.",
    columns: [
      ["name", "Category"],
      ["description", "Description"],
      ["status", "Status"],
    ],
    create: [
      text("name", "Category name", true, 100),
      note("description", "Description"),
    ],
    update: [
      text("name", "Category name", true, 100),
      note("description", "Description"),
      activityStatus,
    ],
  },
  products: {
    title: "Products",
    description:
      "Manage product families and their prices. New products start with one HP variant.",
    columns: [
      ["name", "Product"],
      ["brand", "Brand"],
      ["model", "Model"],
      ["category", "Category"],
      ["variants", "Variants"],
      ["startingPrice", "Starting SRP"],
      ["status", "Status"],
    ],
    create: [
      reference("categoryId", "Product category", "categories"),
      text("name", "Product name"),
      text("brand", "Brand"),
      text("model", "Model"),
      number("horsepower", "Horsepower", { min: 0.5, max: 10, step: 0.5 }),
      number("srp", "Suggested retail price (PHP)", {
        min: 0.01,
        max: 10000000,
        step: 0.01,
      }),
      {
        ...number("promoPrice", "Promotional price (optional)", {
          min: 0.01,
          max: 10000000,
          step: 0.01,
        }),
        nullable: true,
        required: false,
      },
    ],
    update: [
      text("name", "Product name"),
      text("brand", "Brand"),
      text("model", "Model"),
      activityStatus,
    ],
  },
  variants: {
    title: "Product Variants & Prices",
    description:
      "Set selling prices and availability of existing horsepower variants.",
    columns: [
      ["name", "Variant"],
      ["srp", "SRP"],
      ["promoPrice", "Promo price"],
      ["onHand", "On hand"],
      ["reserved", "Reserved"],
      ["status", "Status"],
    ],
    update: [
      number("srp", "SRP (PHP)", { min: 0.01, max: 10000000, step: 0.01 }),
      {
        ...number("promoPrice", "Promo price (optional)", {
          min: 0.01,
          max: 10000000,
          step: 0.01,
        }),
        nullable: true,
        required: false,
      },
      activityStatus,
    ],
  },
  inventory: {
    title: "Inventory",
    description:
      "Available stock = on-hand units minus reserved units. Never edit stock without recording a movement.",
    columns: [
      ["name", "Variant"],
      ["onHand", "On hand"],
      ["reserved", "Reserved"],
      ["available", "Available"],
      ["reorderLevel", "Reorder threshold"],
    ],
    create: [
      reference("variantId", "Variant", "variants"),
      choice("movementType", "Movement type", [
        "STOCK_IN",
        "STOCK_OUT",
        "DAMAGE",
        "RETURN",
        "ADJUSTMENT",
      ]),
      number("quantity", "Quantity (signed for adjustment)", {
        min: -100000,
        max: 100000,
      }),
      note("note", "Reason / supplier reference", true),
    ],
    update: [number("reorderLevel", "Reorder level", { min: 0, max: 1000000 })],
    createLabel: "Record stock movement",
  },
  "stock-movements": {
    title: "Stock Movements",
    description:
      "Permanent stock movement history, including POS sales and manual adjustments.",
    columns: [
      ["product", "Product"],
      ["movementType", "Type"],
      ["quantity", "Change"],
      ["note", "Reason"],
      ["staff", "Recorded by"],
      ["createdAt", "Date"],
    ],
  },
  "service-types": {
    title: "Service Types",
    description:
      "Maintain real service options shown during customer bookings.",
    columns: [
      ["name", "Service"],
      ["code", "Code"],
      ["description", "Description"],
      ["price", "Base price"],
      ["status", "Status"],
    ],
    create: [
      text("name", "Service name"),
      text("code", "Unique code", true, 40),
      note("description", "Description"),
      number("price", "Base price (PHP)", { min: 0, max: 1000000, step: 0.01 }),
    ],
    update: [
      text("name", "Service name"),
      text("code", "Code", true, 40),
      note("description", "Description"),
      number("price", "Base price (PHP)", { min: 0, max: 1000000, step: 0.01 }),
      activityStatus,
    ],
  },
  technicians: {
    title: "Technicians",
    description:
      "Manage profiles linked to actual staff with the TECHNICIAN role.",
    columns: [
      ["code", "Code"],
      ["name", "Name"],
      ["email", "Email"],
      ["status", "Status"],
    ],
    create: [
      reference("userId", "Technician staff account", "techUsers"),
      text("code", "Unique technician code", true, 50),
    ],
    update: [
      choice("status", "Availability", ["ACTIVE", "INACTIVE", "UNAVAILABLE"]),
    ],
  },
  schedules: {
    title: "Schedules",
    description:
      "Record days off and meetings with a reason. A blank time range means the entire day.",
    columns: [
      ["technician", "Technician"],
      ["date", "Date"],
      ["status", "Availability"],
      ["startTime", "From"],
      ["endTime", "To"],
      ["reason", "Reason"],
    ],
    create: [
      reference("technicianId", "Technician", "technicians"),
      date("date", "Day"),
      choice("status", "Availability", ["AVAILABLE", "OFF"]),
      text("reason", "Reason (meeting, leave, training, etc.)", false, 200),
      {
        key: "startTime",
        label: "Unavailable from (optional)",
        type: "time",
        required: false,
      },
      {
        key: "endTime",
        label: "Unavailable until (optional)",
        type: "time",
        required: false,
      },
    ],
    update: [
      choice("status", "Availability", ["AVAILABLE", "OFF"]),
      text("reason", "Reason", false, 200),
      {
        key: "startTime",
        label: "Unavailable from (optional)",
        type: "time",
        required: false,
      },
      {
        key: "endTime",
        label: "Unavailable until (optional)",
        type: "time",
        required: false,
      },
    ],
  },
  customers: {
    title: "Customers",
    description:
      "Real registered customer accounts with order and service history.",
    columns: [
      ["name", "Customer"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["orders", "Orders"],
      ["services", "Services"],
      ["status", "Status"],
    ],
    update: [activityStatus],
  },
  feedback: {
    title: "Customer Feedback",
    description:
      "Real reviews, automatic estimated sentiment, and private staff responses. Reviews remain customer-controlled.",
    columns: [
      ["customer", "Customer"],
      ["rating", "Rating"],
      ["category", "Category"],
      ["comment", "Comment"],
      ["sentiment", "Estimated sentiment"],
      ["publicReview", "Public consent"],
      ["staffReply", "Staff response"],
    ],
    update: [note("staffReply", "Private staff response")],
  },
  "facebook-requests": {
    title: "Facebook Agreements",
    description:
      "Staff manually records Messenger agreements. This page does not read Facebook messages automatically.",
    columns: [
      ["reference", "Reference"],
      ["customer", "Customer"],
      ["requestKind", "Request"],
      ["phone", "Phone"],
      ["serviceName", "Service type"],
      ["airconBrand", "Aircon brand"],
      ["airconModel", "Aircon model"],
      ["scheduledStart", "Agreed schedule"],
      ["conversationUrl", "Messenger chat"],
      ["status", "Status"],
    ],
    create: [
      choice("requestKind", "Agreed request", ["AIRCON", "SERVICE"]),
      text("customerName", "Customer name"),
      text("contactNumber", "Phone", true, 30),
      note("address", "Service or delivery address", true),
      date("scheduledStart", "Agreed date and time", "datetime-local"),
      reference("variantId", "Aircon model", "variants", true),
      number("quantity", "Quantity", { min: 1, max: 100000 }),
      reference("serviceTypeId", "Service type", "serviceTypes", true),
      text("airconBrand", "Aircon brand (service requests)", false, 100),
      text("airconModel", "Aircon model (service requests)", false, 150),
      {
        ...number("airconHp", "Aircon horsepower (service requests)", {
          min: 0.5,
          max: 20,
          step: 0.1,
        }),
        nullable: true,
        required: false,
      },
      text("conversationUrl", "Messenger conversation link", false, 500),
      note("notes", "What was agreed with the customer"),
    ],
    update: [
      choice("action", "Next action", ["CONFIRM", "CONVERT", "CANCEL"]),
      note("note", "Staff note / cancellation reason"),
    ],
  },
  reports: {
    title: "Revenue Reports",
    description:
      "Paid payment totals for the last 12 months. Export exactly the records returned by MySQL.",
    columns: [
      ["period", "Month"],
      ["payments", "Paid payments"],
      ["revenue", "Recorded cash revenue"],
    ],
  },
  notifications: {
    title: "Notifications",
    description: "Your management alerts, stored in the database.",
    columns: [
      ["title", "Title"],
      ["message", "Message"],
      ["type", "Type"],
      ["isRead", "Read"],
      ["createdAt", "Received"],
    ],
    update: [choice("isRead", "Mark as", ["true", "false"])],
  },
  staff: {
    title: "Staff Accounts",
    description:
      "Owner-only staff management. Staff accounts are not customer accounts.",
    columns: [
      ["name", "Staff"],
      ["email", "Email"],
      ["role", "Role"],
      ["status", "Status"],
      ["lastLogin", "Last login"],
    ],
    create: [
      text("name", "Full name"),
      { ...text("email", "Email"), type: "email" },
      choice("role", "Role", ["MANAGER", "SALES_CASHIER", "TECHNICIAN"]),
      {
        ...text("password", "Temporary password", true, 128),
        type: "password",
      },
    ],
    update: [
      choice("role", "Role", ["MANAGER", "SALES_CASHIER", "TECHNICIAN"]),
      choice("status", "Status", ["ACTIVE", "INACTIVE", "SUSPENDED"]),
    ],
  },
  "audit-logs": {
    title: "Audit Logs",
    description:
      "Read-only staff actions recorded in MySQL. Logs cannot be edited here.",
    columns: [
      ["action", "Action"],
      ["module", "Module"],
      ["staff", "Staff"],
      ["recordType", "Record type"],
      ["recordId", "Record ID"],
      ["createdAt", "Date"],
    ],
  },
};
