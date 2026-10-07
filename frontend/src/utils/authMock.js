const CUSTOMER_KEY = "av_current_customer";

const STAFF_KEY = "av_current_staff";

/* ================================
   SAFE STORAGE
================================ */

function safeRead(key) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to read ${key}:`, error);

    localStorage.removeItem(key);

    return null;
  }
}

/* ================================
   CUSTOMER
================================ */

export const readCustomer = () => {
  return safeRead(CUSTOMER_KEY);
};

export const getCustomer = readCustomer;

export const saveCustomer = (customer) => {
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
};

export const loginCustomer = (customer) => {
  saveCustomer(customer);
};

export const clearCustomer = () => {
  localStorage.removeItem(CUSTOMER_KEY);
};

export const logoutCustomer = () => {
  clearCustomer();
};

/* ================================
   STAFF
================================ */

function getStaffName(role) {
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

function normalizeStaff(staff) {
  if (!staff) {
    return null;
  }

  /*
    Compatibility with old prototype
    data such as:

    "OWNER"
  */
  if (typeof staff === "string") {
    return {
      id: `staff-${staff.toLowerCase()}`,
      name: getStaffName(staff),
      username: staff.toLowerCase(),
      role: staff,
    };
  }

  if (typeof staff === "object" && staff.role) {
    return {
      ...staff,

      name: staff.name || getStaffName(staff.role),

      username: staff.username || staff.role.toLowerCase(),
    };
  }

  return null;
}

export const readStaff = () => {
  const staff = safeRead(STAFF_KEY);

  return normalizeStaff(staff);
};

export const getStaff = readStaff;

export const saveStaff = (staff) => {
  const normalized = normalizeStaff(staff);

  if (!normalized) {
    return null;
  }

  localStorage.setItem(STAFF_KEY, JSON.stringify(normalized));

  return normalized;
};

export const loginStaff = (staff) => {
  return saveStaff(staff);
};

export const clearStaff = () => {
  localStorage.removeItem(STAFF_KEY);
};

export const logoutStaff = () => {
  clearStaff();
};
