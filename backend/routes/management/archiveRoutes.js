import { Router } from "express";

import { requireStaffRole } from "../../middleware/requireStaffAuth.js";

import { requireCustomerWriteOrigin } from "../../middleware/requireCustomerWriteOrigin.js";

import {
  listArchiveController,
  archiveRecordController,
  restoreArchiveController,
  permanentlyDeleteArchiveController,
} from "../../controllers/management/archiveController.js";

const router = Router();

router.use(requireStaffRole("OWNER", "MANAGER"));

// List archived records.
router.get("/", listArchiveController);

// Restore archived record.
router.post(
  "/:archiveId/restore",
  requireCustomerWriteOrigin,
  restoreArchiveController,
);

// Permanent deletion is Owner-only.
router.delete(
  "/:archiveId",
  requireStaffRole("OWNER"),
  requireCustomerWriteOrigin,
  permanentlyDeleteArchiveController,
);

// Move a record to Archive.
router.post(
  "/:module/:id",
  requireCustomerWriteOrigin,
  archiveRecordController,
);

export default router;
