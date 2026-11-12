import { Router } from "express";
import {
  requireStaffAuth,
  requireStaffRole,
} from "../../middleware/requireStaffAuth.js";

import categoryRoutes from "./catalog/categoryRoutes.js";
import productRoutes from "./catalog/productRoutes.js";
import variantRoutes from "./catalog/variantRoutes.js";
import inventoryRoutes from "./catalog/inventoryRoutes.js";
import stockMovementRoutes from "./catalog/stockMovementRoutes.js";
import serviceTypeRoutes from "./services/serviceTypeRoutes.js";
import workOrderRoutes from "./services/workOrderRoutes.js";
import technicianOrderProgressRoutes from "./services/technicianOrderProgressRoutes.js";
import technicianRoutes from "./services/technicianRoutes.js";
import scheduleRoutes from "./services/scheduleRoutes.js";
import customerRoutes from "./customers/customerRoutes.js";
import feedbackRoutes from "./customers/feedbackRoutes.js";
import facebookRequestRoutes from "./operations/facebookRequestRoutes.js";
import reportRoutes from "./operations/reportRoutes.js";
import notificationRoutes from "./operations/notificationRoutes.js";
import staffManagementRoutes from "./administration/staffManagementRoutes.js";
import auditLogRoutes from "./administration/auditLogRoutes.js";

const router = Router();

router.use(requireStaffAuth);

// Cashiers may access only their personal notifications
// within the management workspace.
router.use("/notifications", notificationRoutes);

// All remaining workspace modules are restricted
// to management and technicians.
router.use(requireStaffRole("OWNER", "MANAGER", "TECHNICIAN"));

router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/variants", variantRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/stock-movements", stockMovementRoutes);
router.use("/service-types", serviceTypeRoutes);
router.use("/work-orders", workOrderRoutes);
router.use("/technician-order-progress", technicianOrderProgressRoutes);
router.use("/technicians", technicianRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/customers", customerRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/facebook-requests", facebookRequestRoutes);
router.use("/reports", reportRoutes);
router.use("/staff", staffManagementRoutes);
router.use("/audit-logs", auditLogRoutes);

export default router;
