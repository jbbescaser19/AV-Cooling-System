import {
  STAFF_ABSOLUTE_MS,
  STAFF_IDLE_MS,
  STAFF_WARNING_MS,
  signInStaff,
  recordStaffActivity,
  reauthenticateStaff,
  revokeStaffSession,
} from "../../services/management/staffAuthService.js";

const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/management",
  maxAge: STAFF_ABSOLUTE_MS,
};

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
      const { token, staff, session } = await signInStaff(
        req.body?.email,
        req.body?.password,
        req.ip,
      );
      res.cookie("staffAccessToken", token, cookie);
      return res.json({ success: true, staff, session });
    } catch (error) {
      return sendError(res, error);
    }
  },

  session(req, res) {
    return res.json({
      success: true,
      staff: req.staff,
      session: req.staffSession,
      policy: {
        maximumMs: STAFF_ABSOLUTE_MS,
        inactivityMs: STAFF_IDLE_MS,
        warningMs: STAFF_WARNING_MS,
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
      await revokeStaffSession(req.cookies?.staffAccessToken);
      const { maxAge, ...clearOptions } = cookie;
      res.clearCookie("staffAccessToken", clearOptions);
      return res.json({ success: true });
    } catch (error) {
      return sendError(res, error);
    }
  },
};
