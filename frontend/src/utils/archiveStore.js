import { getStaff } from "./authMock";
import { loadMock, saveMock, uid } from "./prototypeStore";
import { auditLogs as seedAuditLogs } from "../data/mockManagement";

const ARCHIVE_KEY = "av_management_archive_v1";
const HIDDEN_INVENTORY_KEY = "av_inventory_archived_keys";
const CAN_ARCHIVE = new Set(["OWNER", "MANAGER"]);

export function canManageArchive() {
  return CAN_ARCHIVE.has(getStaff()?.role);
}

export function readArchive() {
  const entries = loadMock(ARCHIVE_KEY, []);
  return Array.isArray(entries) ? entries : [];
}

export function readArchivedInventoryKeys() {
  const keys = loadMock(HIDDEN_INVENTORY_KEY, []);
  return Array.isArray(keys) ? keys : [];
}

export function managementRecordId(record) {
  return String(record?.id ?? record?.section ?? record?.customer ?? "");
}

function notifyArchiveChange() {
  window.dispatchEvent(new Event("av-management-updated"));
}

function logArchiveAction(action, entry) {
  try {
    const logs = loadMock("av_module_audit-logs", seedAuditLogs);

    saveMock("av_module_audit-logs", [
      {
        id: uid("LOG"),
        time: new Date().toLocaleString("en-PH"),
        user: getStaff()?.name || getStaff()?.role || "Management staff",
        module: entry.category,
        action,
        record: `${entry.label} (${entry.recordId})`,
      },
      ...logs,
    ]);
  } catch (error) {
    console.warn("Archive history could not be added to audit logs", error);
  }
}

function commit(sourceKey, nextSource, nextArchive) {
  const previousSource = localStorage.getItem(sourceKey);
  const previousArchive = localStorage.getItem(ARCHIVE_KEY);

  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(nextArchive));

    localStorage.setItem(sourceKey, JSON.stringify(nextSource));
  } catch (error) {
    try {
      if (previousArchive === null) {
        localStorage.removeItem(ARCHIVE_KEY);
      } else {
        localStorage.setItem(ARCHIVE_KEY, previousArchive);
      }

      if (previousSource === null) {
        localStorage.removeItem(sourceKey);
      } else {
        localStorage.setItem(sourceKey, previousSource);
      }
    } catch {
      // Report the original storage error.
    }

    throw new Error("Could not save the archive. No deletion was confirmed.", {
      cause: error,
    });
  }

  notifyArchiveChange();
}

function archiveMetadata({
  category,
  label,
  sourceKey,
  recordId,
  record,
  kind,
}) {
  const staff = getStaff();

  return {
    id: uid("ARC"),
    category,
    label,
    sourceKey,
    recordId,
    kind,
    record: JSON.parse(JSON.stringify(record)),
    deletedAt: new Date().toISOString(),
    deletedBy: staff?.name || staff?.role || "Management staff",
    deletedByRole: staff?.role || "UNKNOWN",
  };
}

export function archiveManagementRecord({
  category,
  label,
  sourceKey,
  record,
  items,
}) {
  if (!canManageArchive()) {
    throw new Error("Only owners and managers can archive records.");
  }

  if (!Array.isArray(items) || !sourceKey?.startsWith("av_")) {
    throw new Error("The record source is not supported.");
  }

  const recordId = managementRecordId(record);

  if (
    !recordId ||
    !items.some((item) => managementRecordId(item) === recordId)
  ) {
    throw new Error("This record is no longer available.");
  }

  const matching = items.filter(
    (item) => managementRecordId(item) === recordId,
  );

  if (matching.length !== 1) {
    throw new Error(
      "Multiple records have this identifier. Archive was cancelled to avoid removing unrelated data.",
    );
  }

  const nextItems = items.filter(
    (item) => managementRecordId(item) !== recordId,
  );

  const entry = archiveMetadata({
    category,
    label: label || recordId,
    sourceKey,
    recordId,
    record,
    kind: "record",
  });

  commit(sourceKey, nextItems, [entry, ...readArchive()]);

  logArchiveAction("Archived record", entry);

  return nextItems;
}

export function archiveInventoryVariant({ row, quantity }) {
  if (!canManageArchive()) {
    throw new Error("Only owners and managers can archive inventory.");
  }

  const keys = readArchivedInventoryKeys();

  if (keys.includes(row.key)) {
    throw new Error("This inventory entry is already archived.");
  }

  const entry = archiveMetadata({
    category: "Inventory",
    label: `${row.brand} · ${row.product} · ${row.hp}`,
    sourceKey: HIDDEN_INVENTORY_KEY,
    recordId: row.key,
    record: {
      ...row,
      quantity: Number(quantity) || 0,
    },
    kind: "inventory",
  });

  commit(HIDDEN_INVENTORY_KEY, [...keys, row.key], [entry, ...readArchive()]);

  logArchiveAction("Archived inventory variant", entry);

  return [...keys, row.key];
}

export function restoreArchivedRecord(id) {
  if (!canManageArchive()) {
    throw new Error("Only owners and managers can restore records.");
  }

  const entries = readArchive();

  const entry = entries.find((item) => item.id === id);

  if (!entry) {
    throw new Error("The archived record was not found.");
  }

  if (entry.kind === "inventory") {
    const current = readArchivedInventoryKeys();

    if (!current.includes(entry.recordId)) {
      throw new Error(
        "The inventory record is already active. No changes were made.",
      );
    }

    commit(
      HIDDEN_INVENTORY_KEY,
      current.filter((key) => key !== entry.recordId),
      entries.filter((item) => item.id !== id),
    );

    logArchiveAction("Restored inventory variant", entry);

    return entry;
  }

  if (entry.kind !== "record" || !entry.sourceKey?.startsWith("av_")) {
    throw new Error("This archive record cannot be restored automatically.");
  }

  const current = loadMock(entry.sourceKey, []);

  if (!Array.isArray(current)) {
    throw new Error("The destination is not a record list.");
  }

  if (current.some((item) => managementRecordId(item) === entry.recordId)) {
    throw new Error(
      "A record with the same ID already exists. Restore was cancelled.",
    );
  }

  commit(
    entry.sourceKey,
    [entry.record, ...current],
    entries.filter((item) => item.id !== id),
  );

  logArchiveAction("Restored record", entry);

  return entry;
}
