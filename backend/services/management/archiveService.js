import { randomUUID } from "node:crypto";
import connectDB from "../../utils/dbConn.js";
import { auditLogModel } from "../../models/management/administration/auditLogModel.js";
import {
  archiveModel,
  archivableModules,
} from "../../models/management/archiveModel.js";

function demand(staff) {
  if (!staff?.id || !["OWNER", "MANAGER"].includes(staff.role)) {
    throw Object.assign(
      new Error("Only Owner or Manager may manage the archive."),
      { status: 403 },
    );
  }
}
function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}
function validModule(module) {
  if (!archivableModules.includes(module))
    fail("This record type is not safely archivable.", 400);
}
function validId(id) {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
    fail("Invalid record ID.", 400);
  }
  return Number(id);
}
export async function getArchive(staff) {
  demand(staff);
  // Only the Owner can inspect closed account archive metadata.
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
    if (!row) fail("Record not found.", 404);
    if (await model.isArchived(module, id))
      fail("This record is already archived.");
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
      fail(
        "Deactivate this technician's staff account first so they cannot keep signing in.",
      );
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
      fail(
        "Only cancelled, unconverted Facebook requests can be deleted. Cancel the request first.",
      );
    }
    const originalStatus = row.status;
    if (module !== "facebook-requests")
      await model.setCatalogStatus(module, id, "INACTIVE");
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
      message: `${label} moved to Archive. It can be restored for three years.`,
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
  if (!/^[0-9a-f-]{36}$/i.test(String(archiveId)))
    fail("Invalid archive identifier.", 400);
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = archiveModel(connection);
    const entry = await model.lockEntry(archiveId);
    if (!entry) fail("Archive entry not found.", 404);
    // Deleted accounts are anonymized: they cannot be safely reactivated.
    if (["customer-accounts", "staff-accounts"].includes(entry.category)) {
      fail(
        "Deleted accounts cannot be restored. Create a new account if needed.",
        409,
      );
    }
    validModule(entry.category);
    const row = await model.lockCatalogRecord(
      entry.category,
      Number(entry.recordId),
    );
    if (!row)
      fail("Original record is no longer available for restoration.", 409);
    if (entry.category !== "facebook-requests") {
      await model.setCatalogStatus(
        entry.category,
        Number(entry.recordId),
        entry.previousStatus,
      );
    }
    await model.restoreEntry(archiveId);
    await auditLogModel(connection).audit(
      staff.id,
      "RESTORE",
      entry.category,
      entry.recordId,
    );
    await connection.commit();
    return { message: `${entry.label} was restored.` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
/** Daily best-effort hard purge. FK-protected business records stay archived for integrity. */
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
      // Account archive entries store only redacted deletion metadata.
      // At the end of retention, purge that metadata but NEVER delete users,
      // accounting entries, or work history through catalog cleanup.
      if (!["customer-accounts", "staff-accounts"].includes(entry.category)) {
        await model.hardDeleteCatalog(entry.category, Number(entry.recordId));
      }
      await model.markPurged(entry.id);
      await connection.commit();
      purged++;
    } catch (error) {
      await connection.rollback();
      // On FK constraints keep the archived original; historical records cannot be destroyed.
      if (
        ["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(error.code)
      ) {
        // Keep this archived and retry in 30 days instead of blocking newer entries.
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
