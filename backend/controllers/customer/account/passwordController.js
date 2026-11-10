import { changeCustomerPassword } from "../../../services/customer/profile/passwordService.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function changeCustomerPasswordController(req, res) {
  try {
    const result = await changeCustomerPassword(req.auth.userId, req.body);

    // Clear this device's cookies only when
    // the customer requested logout everywhere.
    if (result.signOutAllDevices) {
      res.clearCookie("accessToken", cookieOptions);

      res.clearCookie("refreshToken", cookieOptions);
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;

    if (status === 500) {
      console.error("Password update failed:", error);
    }

    return res.status(status).json({
      success: false,
      message:
        status === 500 ? "Unable to change your password." : error.message,
    });
  }
}
