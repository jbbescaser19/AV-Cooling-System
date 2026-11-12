import {
  STAFF_ACCESS_MS,
  STAFF_REFRESH_MS,
  STAFF_REAUTH_MS,
  signInStaff,
  refreshStaffSession,
  recordStaffActivity,
  reauthenticateStaff,
  revokeStaffSession,
} from "../../services/management/staffAuthService.js";

const sharedCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

const accessCookie = {
  ...sharedCookieOptions,
  path: "/api/management",
  maxAge: STAFF_ACCESS_MS,
};

const refreshCookie = {
  ...sharedCookieOptions,
  path: "/api/management/auth",
  maxAge: STAFF_REFRESH_MS,
};

function setAccessCookie(res, token) {
  res.cookie("staffAccessToken", token, accessCookie);
}

function setRefreshCookie(res, token) {
  res.cookie("staffRefreshToken", token, refreshCookie);
}

function clearAuthCookies(res) {
  const { maxAge: _accessMaxAge, ...accessClear } = accessCookie;
  const { maxAge: _refreshMaxAge, ...refreshClear } = refreshCookie;
  res.clearCookie("staffAccessToken", accessClear);
  res.clearCookie("staffRefreshToken", refreshClear);
}

function sendError(res, error) {
  const status =
    Number(error.status) >= 400 && Number(error.status) < 500
      ? Number(error.status)
      : 500;
  if (status === 500) console.error("Management authentication:", error);
  return res.status(status).json({
    success: false,
    message:
      status === 500 ? "Management authentication unavailable." : error.message,
  });
}

export const staffAuthController = {
  async login(req, res) {
    try {
      const { token, refreshToken, staff, session } = await signInStaff(
        req.body?.email,
        req.body?.password,
        req.ip,
      );
      setAccessCookie(res, token);
      setRefreshCookie(res, refreshToken);
      return res.json({ success: true, staff, session });
    } catch (error) {
      return sendError(res, error);
    }
  },

  async refresh(req, res) {
    try {
      const { token, staff, session } = await refreshStaffSession(
        req.cookies?.staffRefreshToken,
      );
      setAccessCookie(res, token);
      return res.json({ success: true, staff, session });
    } catch (error) {
      if (error.status === 401) clearAuthCookies(res);
      return sendError(res, error);
    }
  },

  session(req, res) {
    return res.json({
      success: true,
      staff: req.staff,
      session: req.staffSession,
      policy: {
        accessMs: STAFF_ACCESS_MS,
        refreshMs: STAFF_REFRESH_MS,
        reauthenticationMs: STAFF_REAUTH_MS,
        inactivityMs: null,
      },
    });
  },

  async activity(req, res) {
    try {
      const { session } = await recordStaffActivity(
        req.cookies?.staffAccessToken,
      );
      return res.json({ success: true, session });
    } catch (error) {
      return sendError(res, error);
    }
  },

  async reauthenticate(req, res) {
    try {
      const { session } = await reauthenticateStaff(
        req.cookies?.staffAccessToken,
        req.body?.password,
        req.ip,
      );
      return res.json({ success: true, session });
    } catch (error) {
      return sendError(res, error);
    }
  },

  async logout(req, res) {
    try {
      await revokeStaffSession(
        req.cookies?.staffAccessToken,
        req.cookies?.staffRefreshToken,
      );
      clearAuthCookies(res);
      return res.json({ success: true });
    } catch (error) {
      return sendError(res, error);
    }
  },
};
