import {
  requestPasswordReset,
  confirmPasswordReset,
} from "../../../services/customer/auth/passwordResetService.js";

function respondError(res, error) {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;

  if (status === 500) {
    console.error("Customer password reset:", error);
  }

  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Password recovery is unavailable. Please try again later."
        : error.message,
  });
}

export async function requestPasswordResetController(req, res) {
  try {
    return res.json({
      success: true,
      ...(await requestPasswordReset(req.body, req.ip)),
    });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function confirmPasswordResetController(req, res) {
  try {
    return res.json({
      success: true,
      ...(await confirmPasswordReset(req.body)),
    });
  } catch (error) {
    return respondError(res, error);
  }
}
