import { Router } from "express";

import { requireCustomerWriteOrigin } from "../../../middleware/requireCustomerWriteOrigin.js";

import { requireStaffRole } from "../../../middleware/requireStaffAuth.js";

import {
  technicianControllers,
  technicianAvailabilityController,
} from "../../../controllers/management/services/technicianController.js";

const router = Router();

router.get(
  "/availability",
  requireStaffRole("OWNER", "MANAGER"),
  technicianAvailabilityController,
);

router.get("/", technicianControllers.list);

router.post("/", requireCustomerWriteOrigin, technicianControllers.create);

router.patch("/:id", requireCustomerWriteOrigin, technicianControllers.update);

export default router;
