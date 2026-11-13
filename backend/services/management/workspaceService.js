import connectDB from "../../utils/dbConn.js";

import {
  archiveModel,
  archivableModules,
} from "../../models/management/archiveModel.js";

import { workspaceModel } from "../../models/management/workspaceModel.js";

import {
  validateWorkspaceInput,
  workspaceId,
} from "../../validators/management/workspaceValidator.js";

import { analyzeFeedbackSentiment } from "../customer/feedback/sentimentAnalyzer.js";

import { fail } from "./workspaceHelpers.js";

import {
  createCategories,
  updateCategories,
} from "./catalog/categoryService.js";

import { createProducts, updateProducts } from "./catalog/productService.js";

import { updateVariants } from "./catalog/variantService.js";

import {
  createInventory,
  updateInventory,
} from "./catalog/inventoryService.js";

import {
  createServiceTypes,
  updateServiceTypes,
} from "./services/serviceTypeService.js";

import {
  createWorkOrders,
  updateWorkOrders,
} from "./services/workOrderService.js";

import {
  createTechnicians,
  updateTechnicians,
} from "./services/technicianService.js";

import {
  createSchedules,
  updateSchedules,
} from "./services/scheduleService.js";

import { updateCustomers } from "./customers/customerService.js";
import { updateFeedback } from "./customers/feedbackService.js";

import {
  createFacebookRequests,
  updateFacebookRequests,
} from "./operations/facebookRequestService.js";

import { updateNotifications } from "./operations/notificationService.js";

import {
  createStaff,
  updateStaff,
} from "./administration/staffManagementService.js";

const roles = {
  categories: ["OWNER", "MANAGER"],
  products: ["OWNER", "MANAGER"],
  variants: ["OWNER", "MANAGER"],
  inventory: ["OWNER", "MANAGER"],
  "stock-movements": ["OWNER", "MANAGER"],
  "service-types": ["OWNER", "MANAGER"],
  "work-orders": ["OWNER", "MANAGER", "TECHNICIAN"],
  technicians: ["OWNER", "MANAGER"],
  schedules: ["OWNER", "MANAGER", "TECHNICIAN"],
  customers: ["OWNER", "MANAGER"],
  feedback: ["OWNER", "MANAGER"],
  "facebook-requests": ["OWNER", "MANAGER"],
  reports: ["OWNER", "MANAGER"],
  notifications: ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"],
  staff: ["OWNER"],
  "audit-logs": ["OWNER"],
};

const writeRoles = {
  categories: ["OWNER", "MANAGER"],
  products: ["OWNER", "MANAGER"],
  variants: ["OWNER", "MANAGER"],
  inventory: ["OWNER", "MANAGER"],
  "service-types": ["OWNER", "MANAGER"],
  "work-orders": ["OWNER", "MANAGER", "TECHNICIAN"],
  technicians: ["OWNER", "MANAGER"],
  schedules: ["OWNER", "MANAGER"],
  customers: ["OWNER", "MANAGER"],
  feedback: ["OWNER", "MANAGER"],
  "facebook-requests": ["OWNER", "MANAGER"],
  notifications: ["OWNER", "MANAGER", "SALES_CASHIER", "TECHNICIAN"],
  staff: ["OWNER"],
};

function authorize(staff, module, write = false) {
  const allowedRoles = write ? writeRoles[module] : roles[module];

  if (!staff?.id || !allowedRoles?.includes(staff.role)) {
    fail("You do not have access to this module.", 403);
  }
}

const createHandlers = {
  categories: createCategories,
  products: createProducts,
  inventory: createInventory,
  "service-types": createServiceTypes,
  "work-orders": createWorkOrders,
  technicians: createTechnicians,
  schedules: createSchedules,
  "facebook-requests": createFacebookRequests,
  staff: createStaff,
};

const updateHandlers = {
  categories: updateCategories,
  products: updateProducts,
  variants: updateVariants,
  inventory: updateInventory,
  "service-types": updateServiceTypes,
  "work-orders": updateWorkOrders,
  technicians: updateTechnicians,
  schedules: updateSchedules,
  customers: updateCustomers,
  feedback: updateFeedback,
  "facebook-requests": updateFacebookRequests,
  notifications: updateNotifications,
  staff: updateStaff,
};

export async function listWorkspace(staff, module) {
  authorize(staff, module);

  const model = workspaceModel(connectDB);

  const rows =
    staff.role === "TECHNICIAN" && module === "work-orders"
      ? await model.techJobs(staff.id)
      : staff.role === "TECHNICIAN" && module === "schedules"
        ? await model.techSchedules(staff.id)
        : await model.list(module, staff.id);

  if (archivableModules.includes(module)) {
    const archived = new Set(await archiveModel(connectDB).activeIds(module));

    for (let i = rows.length - 1; i >= 0; i--) {
      if (archived.has(Number(rows[i].id))) {
        rows.splice(i, 1);
      }
    }
  }

  if (module === "feedback") {
    for (const row of rows) {
      if (row.sentiment === "NOT_ANALYZED") {
        row.sentiment = `${analyzeFeedbackSentiment(
          row.comment,
          row.rating,
        )} (estimated)`;
      }
    }
  }

  let options = {};

  if (
    [
      "products",
      "inventory",
      "work-orders",
      "technicians",
      "schedules",
      "facebook-requests",
    ].includes(module)
  ) {
    // Read-only technician views must not expose
    // unrelated order/service references.
    const readOnlyFieldView =
      (module === "schedules" || module === "work-orders") &&
      !["OWNER", "MANAGER"].includes(staff.role);

    if (!readOnlyFieldView) {
      options = await model.options();
    }
  }

  return {
    items: rows,
    options,
  };
}

export async function createWorkspace(staff, module, raw) {
  authorize(staff, module, true);

  const data = validateWorkspaceInput(module, "create", raw);

  const handler = createHandlers[module];

  if (!handler) {
    fail("This module does not support creating records.");
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = workspaceModel(connection);

    const created = await handler(model, staff, data, connection);

    await model.audit(staff.id, "CREATE", module, created);

    await connection.commit();

    return {
      id: created,
      message:
        module === "inventory"
          ? data.movementType === "STOCK_IN"
            ? `Added ${data.quantity} unit(s) to inventory and recorded the stock movement.`
            : "Stock movement recorded successfully."
          : "Record saved successfully.",
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      fail("A record with these details already exists.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function updateWorkspace(staff, module, rawId, raw) {
  authorize(staff, module, true);

  const id = workspaceId(rawId);

  const data = validateWorkspaceInput(module, "update", raw);

  const handler = updateHandlers[module];

  if (!handler) {
    fail("This module does not support changes.");
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = workspaceModel(connection);

    if (
      archivableModules.includes(module) &&
      (await archiveModel(connection).isArchived(module, id))
    ) {
      fail("Restore this record from Archive before editing it.", 409);
    }

    const { result, converted } = await handler(
      model,
      staff,
      id,
      data,
      connection,
    );

    if (!result || result.affectedRows !== 1) {
      fail("Record not found.", 404);
    }

    await model.audit(staff.id, "UPDATE", module, id);

    await connection.commit();

    return {
      message: converted
        ? converted.convertedOrderId
          ? "Facebook aircon agreement converted to an order. View it in Orders."
          : "Facebook service agreement converted to a service request and work order."
        : "Changes saved.",
      id,
      ...(converted || {}),
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      fail("This record already exists.", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}
