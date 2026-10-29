import connectDB from "../../utils/dbConn.js";
import { customerAddressModel } from "../../models/customer/addressModel.js";

export const MAX_SAVED_ADDRESSES = 5;

const VALID_LABELS = new Set(["HOME", "OFFICE", "OTHER"]);

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parsePositiveId(value, fieldName) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`Invalid ${fieldName}.`, 400);
  }

  return id;
}

async function getActiveCustomer(model, userId, forUpdate = false) {
  const [rows] = await model.findCustomerByUserId(userId, forUpdate);
  const customer = rows[0];

  if (!customer) {
    throw createError("Customer account not found.", 404);
  }

  if (
    customer.userStatus !== "ACTIVE" ||
    customer.customerStatus !== "ACTIVE"
  ) {
    throw createError("Your customer account is inactive.", 403);
  }

  return Number(customer.customerId);
}

function formatAddress(row) {
  return {
    id: row.id,
    label: String(row.label)
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase()),
    address: row.address,
    default: Boolean(row.isDefault),
  };
}

export async function getCustomerAddressesService(userId) {
  const id = parsePositiveId(userId, "customer user ID");
  const connection = await connectDB.getConnection();

  try {
    const model = customerAddressModel(connection);
    const customerId = await getActiveCustomer(model, id);

    const [rows] = await model.findAddressesByCustomerId(customerId);

    return rows.map(formatAddress);
  } finally {
    connection.release();
  }
}

export async function addCustomerAddressService(userId, input) {
  const id = parsePositiveId(userId, "customer user ID");
  const label = String(input?.label ?? "")
    .trim()
    .toUpperCase();
  const fullAddress = String(input?.fullAddress ?? "").trim();

  if (!VALID_LABELS.has(label)) {
    throw createError("Choose Home, Office, or Other.", 400);
  }

  if (!fullAddress || fullAddress.length > 2000) {
    throw createError(
      "Enter a complete address using no more than 2,000 characters.",
      400,
    );
  }

  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = customerAddressModel(connection);
    const customerId = await getActiveCustomer(model, id, true);

    const [countRows] = await model.countAddresses(customerId);
    const total = Number(countRows[0].total);

    if (total >= MAX_SAVED_ADDRESSES) {
      throw createError(
        `You can save up to ${MAX_SAVED_ADDRESSES} addresses.`,
        409,
      );
    }

    // The first saved address becomes the default automatically.
    const isDefault = total === 0;

    const [result] = await model.createAddress(
      customerId,
      label,
      fullAddress,
      isDefault,
    );

    await connection.commit();

    return {
      id: result.insertId,
      label: label.charAt(0) + label.slice(1).toLowerCase(),
      address: fullAddress,
      default: isDefault,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setDefaultCustomerAddressService(userId, addressId) {
  const id = parsePositiveId(userId, "customer user ID");
  const targetAddressId = parsePositiveId(addressId, "address ID");
  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = customerAddressModel(connection);
    const customerId = await getActiveCustomer(model, id, true);

    const [rows] = await model.findAddressById(customerId, targetAddressId);

    if (!rows.length) {
      throw createError("Address not found.", 404);
    }

    await model.clearDefaultAddresses(customerId);

    await model.setAddressDefault(customerId, targetAddressId);

    await connection.commit();

    return { message: "Default address updated." };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteCustomerAddressService(userId, addressId) {
  const id = parsePositiveId(userId, "customer user ID");
  const targetAddressId = parsePositiveId(addressId, "address ID");
  const connection = await connectDB.getConnection();

  try {
    await connection.beginTransaction();

    const model = customerAddressModel(connection);
    const customerId = await getActiveCustomer(model, id, true);

    const [rows] = await model.findAddressById(customerId, targetAddressId);

    const address = rows[0];

    if (!address) {
      throw createError("Address not found.", 404);
    }

    await model.deleteAddress(customerId, targetAddressId);

    if (Boolean(address.isDefault)) {
      const [remainingAddresses] =
        await model.findAddressesByCustomerId(customerId);

      if (remainingAddresses.length > 0) {
        await model.clearDefaultAddresses(customerId);

        await model.setAddressDefault(customerId, remainingAddresses[0].id);
      }
    }

    await connection.commit();

    return { message: "Address deleted." };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
