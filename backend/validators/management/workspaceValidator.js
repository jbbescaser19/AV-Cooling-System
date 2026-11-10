import { id } from "./workspacePrimitives.js";
import { categorySchemas } from "./catalog/categoryValidator.js";
import { productSchemas } from "./catalog/productValidator.js";
import { variantSchemas } from "./catalog/variantValidator.js";
import { inventorySchemas } from "./catalog/inventoryValidator.js";
import { serviceTypeSchemas } from "./services/serviceTypeValidator.js";
import { workOrderSchemas } from "./services/workOrderValidator.js";
import { technicianSchemas } from "./services/technicianValidator.js";
import { scheduleSchemas } from "./services/scheduleValidator.js";
import { customerSchemas } from "./customers/customerValidator.js";
import { feedbackSchemas } from "./customers/feedbackValidator.js";
import { facebookRequestSchemas } from "./operations/facebookRequestValidator.js";
import { notificationSchemas } from "./operations/notificationValidator.js";
import { staffManagementSchemas } from "./administration/staffManagementValidator.js";
const schemas = {
  ...categorySchemas,
  ...productSchemas,
  ...variantSchemas,
  ...inventorySchemas,
  ...serviceTypeSchemas,
  ...workOrderSchemas,
  ...technicianSchemas,
  ...scheduleSchemas,
  ...customerSchemas,
  ...feedbackSchemas,
  ...facebookRequestSchemas,
  ...notificationSchemas,
  ...staffManagementSchemas,
};
export function validateWorkspaceInput(module, action, body) {
  const schema = schemas[module]?.[action];
  if (!schema) {
    throw Object.assign(new Error("Unsupported operation."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid input."),
      { status: 400 },
    );
  }
  return parsed.data;
}
export function workspaceId(raw) {
  const parsed = id.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid record ID."), { status: 400 });
  }
  return parsed.data;
}
