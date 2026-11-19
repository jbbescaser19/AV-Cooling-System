import connectDB from "../../utils/dbConn.js";

import {
  archiveModel,
  archivableModules,
} from "../../models/management/archiveModel.js";

import { permanentArchiveModel } from "../../models/management/permanentArchiveModel.js";

import { auditLogModel } from "../../models/management/administration/auditLogModel.js";

import { purgeArchivedCustomer } from "./customers/customerArchiveService.js";

import { purgeArchivedStaff } from "./administration/staffAccountDeletionService.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), {
    status,
  });
}

/**
 * Shared permanent deletion process.
 * Caller must own the active database transaction.
 */
export async function purgeLockedArchive(connection, entry) {
  const archive = archiveModel(connection);

  const guards = permanentArchiveModel(connection);

  const id = Number(entry.recordId);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail("Invalid archived record identifier.");
  }

  if (entry.category === "customer-accounts") {
    await purgeArchivedCustomer(connection, entry);
  } else if (entry.category === "staff-accounts") {
    await purgeArchivedStaff(connection, entry);
  } else {
    if (!archivableModules.includes(entry.category)) {
      fail("This type cannot be permanently deleted.");
    }

    const row = await archive.lockCatalogRecord(entry.category, id);

    if (row) {
      const expected =
        entry.category === "facebook-requests" ? "CANCELLED" : "INACTIVE";

      if (row.status !== expected) {
        fail("Original record is no longer archived.");
      }

      if (await archive.hasInventory(entry.category, id)) {
        fail("Resolve remaining stock and reservations first.");
      }

      if (
        entry.category === "categories" &&
        (await archive.categoryHasActiveProducts(id))
      ) {
        fail("This category still contains active products.");
      }

      if (
        entry.category === "products" &&
        (await guards.hasArchivedVariants(id))
      ) {
        fail(
          "Resolve separately archived variants before deleting the product.",
        );
      }

      if (
        entry.category === "technicians" &&
        ((await archive.technicianAccountStillActive(id)) ||
          (await archive.technicianHasActiveWork(id)))
      ) {
        fail("The technician still has an active account or assigned work.");
      }

      if (
        entry.category === "facebook-requests" &&
        (row.converted_order_id ||
          row.converted_work_order_id ||
          (await guards.hasFacebookReferences(id)))
      ) {
        fail("This agreement is still linked to business records.");
      }

      if (
        entry.category === "service-types" &&
        (await guards.hasServiceTypeReferences(id))
      ) {
        fail("This service type is still linked to Facebook agreements.");
      }

      await guards.removeEmptyInventory(entry.category, id);

      const deleted = await archive.hardDeleteCatalog(entry.category, id);

      if (deleted !== 1) {
        fail("Original record changed. Refresh and try again.");
      }
    }
  }

  // Remove recoverable information and prevent restoration.
  await archive.markPurged(entry.id);
}

export async function permanentlyDeleteArchive(staff, archiveId, body) {
  if (!staff?.id || staff.role !== "OWNER") {
    fail("Owner access required.", 403);
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(archiveId),
    )
  ) {
    fail("Invalid archive identifier.", 400);
  }

  if (body?.confirm !== true) {
    fail("Confirm permanent deletion first.", 400);
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const archive = archiveModel(connection);

    const entry = await archive.lockEntry(archiveId);

    if (!entry) {
      fail("Archive entry not found.", 404);
    }

    await purgeLockedArchive(connection, entry);

    await auditLogModel(connection).audit(
      staff.id,
      "PERMANENT_DELETE",
      entry.category,
      Number(entry.recordId),
    );

    await connection.commit();

    const account = ["customer-accounts", "staff-accounts"].includes(
      entry.category,
    );

    return {
      message: account
        ? "Account permanently closed and removed from Archive. Required business history was preserved."
        : "Archived record permanently deleted.",
    };
  } catch (error) {
    await connection.rollback();

    if (
      ["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(error.code)
    ) {
      fail(
        "This record is required by existing business history and cannot be permanently deleted.",
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}
