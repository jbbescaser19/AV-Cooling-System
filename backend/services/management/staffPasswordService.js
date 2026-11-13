import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

import connectDB from "../../utils/dbConn.js";

import { staffPasswordModel } from "../../models/management/staffPasswordModel.js";
import { staffSessionModel } from "../../models/management/staffSessionModel.js";

import {
  validateStaffChange,
  validateOwnerReset,
} from "../../validators/management/staffPasswordValidator.js";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export async function changeStaffPassword(actor, input) {
  const values = validateStaffChange(input);

  if (!Number.isSafeInteger(Number(actor?.id))) {
    fail("Staff login required.", 401);
  }

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = staffPasswordModel(db);

    const staff = await model.lockStaff(actor.id);

    if (
      !staff ||
      !(await bcrypt.compare(values.currentPassword, staff.passwordHash))
    ) {
      fail("Current password is incorrect.", 403);
    }

    if (await bcrypt.compare(values.newPassword, staff.passwordHash)) {
      fail("Choose a different new password.");
    }

    const hash = await bcrypt.hash(values.newPassword, 12);

    if ((await model.changeOwnPassword(actor.id, hash)) !== 1) {
      fail("Account no longer active.", 409);
    }

    await staffSessionModel(db).revokeAllForStaff(actor.id);

    await model.audit(actor.id, actor.id, "STAFF_PASSWORD_CHANGED");

    await db.commit();

    return {
      message:
        "Password changed. All staff sessions have been signed out. Log in again.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

export async function listStaffForPasswordReset(actor) {
  if (actor?.role !== "OWNER") {
    fail("Owner access required.", 403);
  }

  return staffPasswordModel(connectDB).listResettable();
}

export async function ownerResetStaffPassword(actor, input) {
  if (actor?.role !== "OWNER") {
    fail("Owner access required.", 403);
  }

  const { staffId, ownerPassword } = validateOwnerReset(input);

  if (Number(actor.id) === staffId) {
    fail("Use Change Password for your own account.", 403);
  }

  const db = await connectDB.getConnection();

  try {
    await db.beginTransaction();

    const model = staffPasswordModel(db);

    const owner = await model.lockStaff(actor.id);

    if (
      !owner ||
      owner.role !== "OWNER" ||
      !(await bcrypt.compare(ownerPassword, owner.passwordHash))
    ) {
      fail("Owner password is incorrect.", 403);
    }

    const target = await model.lockStaff(staffId);

    if (!target || target.role === "OWNER") {
      fail("Active non-owner staff account not found.", 404);
    }

    const temporaryPassword = randomBytes(18).toString("base64url");

    const hash = await bcrypt.hash(temporaryPassword, 12);

    if ((await model.resetStaffPassword(staffId, hash)) !== 1) {
      fail("Password reset failed.", 409);
    }

    await staffSessionModel(db).revokeAllForStaff(staffId);

    await model.audit(actor.id, staffId, "OWNER_RESET_STAFF_PASSWORD");

    await db.commit();

    return {
      temporaryPassword,
      message:
        "Temporary password generated. Share it privately with the staff member. They must change it after login.",
    };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
