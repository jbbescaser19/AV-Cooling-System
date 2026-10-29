import {
  getCustomerAddressesService,
  addCustomerAddressService,
  setDefaultCustomerAddressService,
  deleteCustomerAddressService,
} from "../../services/customer/addressService.js";

function sendError(res, error, operation) {
  if (!error.status || error.status >= 500) {
    console.error(`customerAddressController - ${operation}: ${error.message}`);
  }

  return res.status(error.status || 500).json({
    success: false,
    message:
      error.status && error.status < 500
        ? error.message
        : "Unable to process the address request.",
  });
}

export async function getCustomerAddressesController(req, res) {
  try {
    const addresses = await getCustomerAddressesService(req.auth.userId);

    return res.status(200).json({
      success: true,
      addresses,
    });
  } catch (error) {
    return sendError(res, error, "getAddresses");
  }
}

export async function addCustomerAddressController(req, res) {
  try {
    const address = await addCustomerAddressService(req.auth.userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Address saved successfully.",
      address,
    });
  } catch (error) {
    return sendError(res, error, "addAddress");
  }
}

export async function setDefaultCustomerAddressController(req, res) {
  try {
    const result = await setDefaultCustomerAddressService(
      req.auth.userId,
      req.params.addressId,
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return sendError(res, error, "setDefaultAddress");
  }
}

export async function deleteCustomerAddressController(req, res) {
  try {
    const result = await deleteCustomerAddressService(
      req.auth.userId,
      req.params.addressId,
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return sendError(res, error, "deleteAddress");
  }
}
