import {
  getCustomerProfileService,
  updateCustomerProfileService,
} from "../../../services/customer/profile/profileService.js";

function sendError(res, error, operation, fallbackMessage) {
  const status =
    Number(error.status) >= 400 && Number(error.status) < 500
      ? Number(error.status)
      : 500;

  if (status === 500) {
    console.error(`customerAccountController - ${operation}:`, error.message);
  }

  return res.status(status).json({
    success: false,
    message: status === 500 ? fallbackMessage : error.message,
  });
}

function isCustomer(req) {
  return String(req.auth?.accountType ?? "").toUpperCase() === "CUSTOMER";
}

export async function getCustomerProfileController(req, res) {
  if (!isCustomer(req)) {
    return res.status(403).json({
      success: false,
      message: "Customer access is required.",
    });
  }

  try {
    const user = await getCustomerProfileService(req.auth.userId);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "getProfile",
      "Failed to load customer profile.",
    );
  }
}

export async function updateCustomerProfileController(req, res) {
  if (!isCustomer(req)) {
    return res.status(403).json({
      success: false,
      message: "Customer access is required.",
    });
  }

  try {
    const user = await updateCustomerProfileService(req.auth.userId, req.body);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "updateProfile",
      "Unable to update your profile.",
    );
  }
}
