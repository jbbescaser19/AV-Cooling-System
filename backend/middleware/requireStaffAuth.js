import { verifyStaffSession } from "../services/management/staffAuthService.js";

/**
 * Validates the staff access token and database session.
 */
export async function requireStaffAuth(req, res, next) {
  try {
    const { staff, session } = await verifyStaffSession(
      req.cookies?.staffAccessToken,
    );

    req.staff = staff;
    req.staffSession = session;

    // Staff using a temporary password cannot
    // access other Management APIs yet.
    const recoveryRoute = req.originalUrl.split("?")[0];

    const allowed = [
      "/api/management/auth/session",
      "/api/management/auth/change-password",
    ];

    if (staff.mustChangePassword && !allowed.includes(recoveryRoute)) {
      return res.status(403).json({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Change your temporary password to continue.",
      });
    }

    return next();
  } catch (error) {
    const status = error.status === 401 ? 401 : 500;

    if (status === 500) {
      console.error("Staff authorization:", error);
    }

    return res.status(status).json({
      success: false,
      message: status === 401 ? error.message : "Cannot verify staff access.",
    });
  }
}

export function requireStaffRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.staff || !allowedRoles.includes(req.staff.role)) {
      return res.status(403).json({
        success: false,
        message: "This staff role cannot perform that action.",
      });
    }

    return next();
  };
}

/**
 * Sensitive staff management changes
 * require recent password confirmation.
 */
export function requireStaffRecentAuth(req, res, next) {
  if (
    !req.staffSession?.reauthenticatedUntil ||
    req.staffSession.reauthenticatedUntil <= Date.now()
  ) {
    return res.status(403).json({
      success: false,
      code: "REAUTH_REQUIRED",
      message: "Confirm your password again before changing staff accounts.",
    });
  }

  return next();
}
