import {
  registerCustomerService,
  loginCustomerService,
  refreshCustomerSessionService,
} from "../../services/customer/authServices.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const accessCookieOptions = {
  ...cookieOptions,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
}

function isCustomerAccount(req) {
  const accountType = String(
    req.auth?.accountType ?? req.auth?.account_type ?? "",
  ).toUpperCase();

  return accountType === "CUSTOMER";
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

export async function refreshCustomerSessionController(req, res) {
  try {
    const { accessToken } = await refreshCustomerSessionService(
      req.cookies?.refreshToken,
    );

    res.cookie("accessToken", accessToken, accessCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Session refreshed.",
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearAuthCookies(res);
    }

    if (!error.status || error.status >= 500) {
      console.error(`authController - refreshSession: ${error.message}`);
    }

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status && error.status < 500
          ? error.message
          : "Unable to refresh your session.",
    });
  }
}

export function checkCustomerSessionController(req, res) {
  if (!isCustomerAccount(req)) {
    return res.status(403).json({
      success: false,
      authenticated: false,
      message: "A customer account is required.",
    });
  }

  return res.status(200).json({
    success: true,
    authenticated: true,
  });
}

export function logoutCustomerController(req, res) {
  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}
