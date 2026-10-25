import {
  registerCustomerService,
  loginCustomerService,
} from "../../services/customer/authServices.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);
}

export async function registerCustomerController(req, res) {
  try {
    const result = await registerCustomerService(req.body);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error(`authController - registerCustomer: ${error.message}`);

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status && error.status < 500
          ? error.message
          : "Registration failed. Please try again.",
    });
  }
}

export async function loginCustomerController(req, res) {
  try {
    const result = await loginCustomerService(req.body);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return res.status(200).json({
      success: true,
      message: result.message,
      user: result.user,
    });
  } catch (error) {
    console.error(`authController - loginCustomer: ${error.message}`);

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status && error.status < 500
          ? error.message
          : "Login failed. Please try again.",
    });
  }
}

export function getCurrentCustomerController(req, res) {
  return res.status(200).json({
    success: true,
    user: req.auth,
  });
}

export function logoutCustomerController(req, res) {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}
