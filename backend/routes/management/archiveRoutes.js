import { Router } from "express";
import { requireStaffRole } from "../../middleware/requireStaffAuth.js";
import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  listArchiveController,
  archiveRecordController,
  restoreArchiveController,
} from "../../controllers/management/archiveController.js";

const router = Router();

router.use(requireStaffRole("OWNER", "MANAGER"));

// Get all archived records
router.get("/", listArchiveController);

// IMPORTANT:
// Restore must come BEFORE the generic archive route.
// Otherwise Express treats the archive UUID as a module name.
router.post(
  "/:archiveId/restore",
  requireCustomerWriteOrigin,
  restoreArchiveController,
);

// Move a record to Archive
router.post(
  "/:module/:id",
  requireCustomerWriteOrigin,
  archiveRecordController,
);

export default router;
