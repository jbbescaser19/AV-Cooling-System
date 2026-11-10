/** Thin compatibility/composition layer: no SQL is stored here.
 * Existing customer and management callers can keep using workspaceModel(db).
 */
import { categoryModel } from "./catalog/categoryModel.js";
import { productModel } from "./catalog/productModel.js";
import { variantModel } from "./catalog/variantModel.js";
import { inventoryModel } from "./catalog/inventoryModel.js";
import { stockMovementModel } from "./catalog/stockMovementModel.js";
import { serviceTypeModel } from "./services/serviceTypeModel.js";
import { workOrderModel } from "./services/workOrderModel.js";
import { technicianModel } from "./services/technicianModel.js";
import { scheduleModel } from "./services/scheduleModel.js";
import { customerModel } from "./customers/customerModel.js";
import { feedbackModel } from "./customers/feedbackModel.js";
import { facebookRequestModel } from "./operations/facebookRequestModel.js";
import { orderModel } from "./sales/workspaceOrderModel.js";
import { paymentModel } from "./sales/workspacePaymentModel.js";
import { serviceRequestModel } from "./services/serviceRequestModel.js";
import { staffManagementModel } from "./administration/staffManagementModel.js";
import { staffSessionModel } from "./staffSessionModel.js";
import { notificationModel } from "./operations/notificationModel.js";
import { auditLogModel } from "./administration/auditLogModel.js";
import { referenceOptionsModel } from "./referenceOptionsModel.js";
import { reportModel } from "./operations/reportModel.js";
export function workspaceModel(db) {
  const category = categoryModel(db);
  const product = productModel(db);
  const variant = variantModel(db);
  const inventory = inventoryModel(db);
  const stockMovement = stockMovementModel(db);
  const serviceType = serviceTypeModel(db);
  const workOrder = workOrderModel(db);
  const technician = technicianModel(db);
  const schedule = scheduleModel(db);
  const customer = customerModel(db);
  const feedback = feedbackModel(db);
  const facebookRequest = facebookRequestModel(db);
  const order = orderModel(db);
  const payment = paymentModel(db);
  const serviceRequest = serviceRequestModel(db);
  const staffManagement = staffManagementModel(db);
  const staffSessions = staffSessionModel(db);
  const notification = notificationModel(db);
  const auditLog = auditLogModel(db);
  const referenceOptions = referenceOptionsModel(db);
  const report = reportModel(db);
  return {
    ...category,
    ...product,
    ...variant,
    ...inventory,
    ...stockMovement,
    ...serviceType,
    ...workOrder,
    ...technician,
    ...schedule,
    ...customer,
    ...feedback,
    ...facebookRequest,
    ...order,
    ...payment,
    ...serviceRequest,
    ...staffManagement,
    revokeAllForStaff: staffSessions.revokeAllForStaff,
    ...notification,
    ...auditLog,
    ...referenceOptions,
    ...report,
    list(module, staffId) {
      switch (module) {
        case "categories":
          return category.listCategories(staffId);
        case "products":
          return product.listProducts(staffId);
        case "variants":
          return variant.listVariants(staffId);
        case "inventory":
          return inventory.listInventory(staffId);
        case "stock-movements":
          return stockMovement.listStockMovements(staffId);
        case "service-types":
          return serviceType.listServiceTypes(staffId);
        case "work-orders":
          return workOrder.listWorkOrders(staffId);
        case "technicians":
          return technician.listTechnicians(staffId);
        case "schedules":
          return schedule.listSchedules(staffId);
        case "customers":
          return customer.listCustomers(staffId);
        case "feedback":
          return feedback.listFeedback(staffId);
        case "facebook-requests":
          return facebookRequest.listFacebookRequests(staffId);
        case "reports":
          return report.listReports(staffId);
        case "notifications":
          return notification.listNotifications(staffId);
        case "staff":
          return staffManagement.listStaff(staffId);
        case "audit-logs":
          return auditLog.listAuditLogs(staffId);
        default:
          throw Object.assign(new Error("Unknown management module."), {
            status: 404,
          });
      }
    },
  };
}
