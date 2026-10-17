import { registerCustomerService } from "../../services/customer/authServices.js";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
  });
}

export async function registerCustomerController(req, res) {
  try {
    const result = await registerCustomerService(req.body);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res
      .status(201)
      .json({ success: true, message: result.message, user: result.user });
  } catch (error) {
    console.error(`authController - registerCustomer: ${error.message}`);
    return res.status(error.status || 500).json({
      message:
        error.status && error.status < 500
          ? error.message
          : "Registration failed. Please try again.",
    });
  }
}
