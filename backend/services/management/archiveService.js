import { randomUUID } from "node:crypto";

import connectDB from "../../utils/dbConn.js";

import { auditLogModel } from "../../models/management/administration/auditLogModel.js";

import {
  archiveModel,
  archivableModules,
} from "../../models/management/archiveModel.js";

import { restoreArchivedCustomer } from "./customers/customerArchiveService.js";

import { restoreArchivedStaff } from "./administration/staffAccountDeletionService.js";

import { purgeLockedArchive } from "./permanentArchiveService.js";

function demand(staff) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    fail("Only Owner or Manager may manage the archive.", 403);
  }
}

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

function validModule(module) {
  if (!archivableModules.includes(module)) {
    fail("This record type is not safely archivable.", 400);
  }
}

function validId(id) {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
    fail("Invalid record ID.", 400);
  }

  return Number(id);
}

export async function getArchive(staff) {
  demand(staff);

  return {
    items: await archiveModel(connectDB).list(staff.role === "OWNER"),

    canViewDeletedAccounts: staff.role === "OWNER",
  };
}

export async function archiveCatalogRecord(staff, module, rawId, raw = {}) {
  demand(staff);
  validModule(module);

  const id = validId(rawId);

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = archiveModel(connection);

    const row = await model.lockCatalogRecord(module, id);

    if (!row) {
      fail("Record not found.", 404);
    }

    if (await model.isArchived(module, id)) {
      fail("This record is already archived.");
    }

    if (await model.hasInventory(module, id)) {
      fail(
        "This product still has stock or reservations. Move or resolve the inventory before deleting it.",
      );
    }

    if (
      module === "categories" &&
      (await model.categoryHasActiveProducts(id))
    ) {
      fail(
        "This category still contains active products. Archive or move those products first.",
      );
    }

    if (
      module === "technicians" &&
      (await model.technicianAccountStillActive(id))
    ) {
      fail("Deactivate this technician's staff account first.");
    }

    if (module === "technicians" && (await model.technicianHasActiveWork(id))) {
      fail("This technician has active work. Reassign the jobs first.");
    }

    if (
      module === "facebook-requests" &&
      (row.status !== "CANCELLED" ||
        row.converted_order_id ||
        row.converted_work_order_id)
    ) {
      fail("Only cancelled, unconverted Facebook requests can be deleted.");
    }

    const originalStatus = row.status;

    if (module !== "facebook-requests") {
      await model.setCatalogStatus(module, id, "INACTIVE");
    }

    const label = String(
      row.product_name ||
        row.category_name ||
        row.service_name ||
        row.technician_code ||
        row.customer_name ||
        (row.horsepower
          ? `${row.horsepower} HP · Variant #${id}`
          : `Record #${id}`),
    );

    const origin =
      module === "variants" && raw?.origin === "inventory"
        ? "inventory"
        : module;

    await model.add({
      archiveId: randomUUID(),
      module,
      origin,
      id,
      label,
      snapshot: row,
      previousStatus: originalStatus,
      staffId: staff.id,
    });

    await auditLogModel(connection).audit(staff.id, "ARCHIVE", module, id);

    await connection.commit();

    return {
      message: `${label} moved to Archive. It can be restored or permanently deleted.`,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function restoreCatalogRecord(staff, archiveId) {
  demand(staff);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(archiveId),
    )
  ) {
    fail("Invalid archive identifier.", 400);
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = archiveModel(connection);

    const entry = await model.lockEntry(archiveId);

    if (!entry) {
      fail("Archive entry not found.", 404);
    }

    if (entry.category === "customer-accounts") {
      await restoreArchivedCustomer(connection, staff, entry);
    } else if (entry.category === "staff-accounts") {
      await restoreArchivedStaff(connection, staff, entry);
    } else {
      validModule(entry.category);

      const row = await model.lockCatalogRecord(
        entry.category,
        Number(entry.recordId),
      );

      if (!row) {
        fail("Original record is no longer available for restoration.");
      }

      if (entry.category !== "facebook-requests") {
        await model.setCatalogStatus(
          entry.category,
          Number(entry.recordId),
          entry.previousStatus,
        );
      }
    }

    const restored = await model.restoreEntry(archiveId);

    if (restored !== 1) {
      fail("Archive entry changed. Refresh and try again.");
    }

    await auditLogModel(connection).audit(
      staff.id,
      "RESTORE",
      entry.category,
      entry.recordId,
    );

    await connection.commit();

    return {
      message: `${entry.label} was restored.`,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Automatically purge expired archive entries.
 * Use the same safeguards as manual permanent deletion.
 */
export async function purgeExpiredArchive() {
  const candidates = await archiveModel(connectDB).expirationCandidates();

  let purged = 0;

  for (const candidate of candidates) {
    const connection = await connectDB.getConnection();

    try {
      await connection.beginTransaction();

      const model = archiveModel(connection);

      const entry = await model.lockEntry(candidate.id);

      if (!entry) {
        await connection.rollback();
        continue;
      }

      await purgeLockedArchive(connection, entry);

      await connection.commit();

      purged++;
    } catch (error) {
      await connection.rollback();

      const protectedRecord =
        error.status === 409 ||
        ["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(error.code);

      if (protectedRecord) {
        await archiveModel(connectDB)
          .deferPurge(candidate.id)
          .catch((reason) =>
            console.error("Could not defer archive cleanup:", reason),
          );
      } else {
        console.error("Archive retention cleanup:", error);
      }
    } finally {
      connection.release();
    }
  }

  return purged;
}
