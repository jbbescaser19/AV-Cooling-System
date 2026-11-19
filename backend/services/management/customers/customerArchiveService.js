import { randomBytes } from "node:crypto";

import { customerArchiveModel } from "../../../models/management/customers/customerArchiveModel.js";

import { customerDeletionModel } from "../../../models/management/customers/customerDeletionModel.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), {
    status,
  });
}

export async function archiveCustomerForRestore(db, customerId) {
  const model = customerArchiveModel(db);

  const account = await model.lockAccount(customerId);

  if (!account || account.deletedAt) {
    fail("Customer not found or already archived.");
  }

  const result = await model.archiveAccount(customerId, account.userId);

  if (result.affectedRows !== 1) {
    fail("Customer account changed. Try again.");
  }

  return {
    restorable: true,
    userId: account.userId,
    originalStatus: account.userStatus,
    previousCustomerStatus: account.customerStatus,
  };
}

export async function restoreArchivedCustomer(db, staff, entry) {
  if (staff.role !== "OWNER") {
    fail("Only the Owner can restore customer accounts.", 403);
  }

  const model = customerArchiveModel(db);

  const snapshot = await model.getSnapshot(entry.id);

  if (snapshot?.restorable !== true) {
    fail("This account was previously anonymized and cannot be restored.");
  }

  const account = await model.lockAccount(Number(entry.recordId));

  if (
    !account ||
    !account.deletedAt ||
    account.userStatus !== "INACTIVE" ||
    account.customerStatus !== "INACTIVE" ||
    Number(account.userId) !== Number(snapshot.userId)
  ) {
    fail("Archived account is no longer restorable.");
  }

  if (
    !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(snapshot.originalStatus) ||
    !["ACTIVE", "INACTIVE"].includes(snapshot.previousCustomerStatus)
  ) {
    fail("Invalid previous account status.");
  }

  const result = await model.restoreAccount(
    account.id,
    account.userId,
    snapshot.previousCustomerStatus,
    snapshot.originalStatus,
  );

  if (result.affectedRows !== 1) {
    fail("Unable to restore the account.");
  }
}

export async function purgeArchivedCustomer(db, entry) {
  const model = customerArchiveModel(db);

  const snapshot = await model.getSnapshot(entry.id);

  if (!snapshot) {
    fail("Customer archive record not found.");
  }

  // Legacy deleted accounts were already anonymized.
  if (snapshot.restorable !== true) {
    return;
  }

  const account = await model.lockAccount(Number(entry.recordId));

  if (
    !account ||
    !account.deletedAt ||
    account.userStatus !== "INACTIVE" ||
    account.customerStatus !== "INACTIVE" ||
    Number(account.userId) !== Number(snapshot.userId)
  ) {
    fail("Account is no longer safely deletable.");
  }

  const deletion = customerDeletionModel(db);

  await deletion.removePersonalSettings(account.id);
  await deletion.closeCustomer(account.id);

  const result = await model.permanentlyCloseLogin(
    account.userId,

    `deleted-customer-${account.userId}@accounts.invalid`,

    randomBytes(48).toString("hex"),
  );

  if (result.affectedRows !== 1) {
    fail("Unable to permanently close the account.");
  }

  await model.redactArchiveLabel(entry.id, account.id);
}
