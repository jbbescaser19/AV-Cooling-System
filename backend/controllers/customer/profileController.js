import { getCustomerProfileService } from "../../services/customer/profileService.js";

export async function getCustomerProfileController(req, res) {
  const accountType = String(req.auth?.accountType ?? "").toUpperCase();

  if (accountType !== "CUSTOMER") {
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
    if (!error.status || error.status >= 500) {
      console.error(`customerAccountController - getProfile: ${error.message}`);
    }

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status && error.status < 500
          ? error.message
          : "Failed to load customer profile.",
    });
  }
}
