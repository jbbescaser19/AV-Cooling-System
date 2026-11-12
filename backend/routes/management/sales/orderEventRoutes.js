import { Router } from "express";
import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";
import {
  listManagementOrders,
  changeManagementOrder,
} from "../../../controllers/management/sales/orderEventController.js";
const router = Router();
router.get(
  "/orders",
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
  listManagementOrders,
);
router.post(
  "/orders/:orderNumber/events",
  requireStaffRole("OWNER", "MANAGER", "SALES_CASHIER"),
  requireCustomerWriteOrigin,
  (req, res, next) => {
    if (
      req.staff?.role === "SALES_CASHIER" &&
      Array.isArray(req.body?.technicianIds) &&
      req.body.technicianIds.length > 0
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only an Owner or Manager can assign technicians.",
        });
    }
    next();
  },
  changeManagementOrder,
);
export default router;
