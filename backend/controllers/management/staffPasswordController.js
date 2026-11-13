import {
  changeStaffPassword,
  listStaffForPasswordReset,
  ownerResetStaffPassword,
} from "../../services/management/staffPasswordService.js";

function errorResponse(res, error) {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;

  if (status === 500) {
    console.error("Staff password operations:", error);
  }

  return res.status(status).json({
    success: false,
    message:
      status === 500 ? "Unable to update staff password." : error.message,
  });
}

export const staffPasswordController = {
  async change(req, res) {
    try {
      return res.json({
        success: true,
        ...(await changeStaffPassword(req.staff, req.body)),
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  },

  async options(req, res) {
    try {
      return res.json({
        success: true,
        items: await listStaffForPasswordReset(req.staff),
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  },

  async reset(req, res) {
    try {
      return res.json({
        success: true,
        ...(await ownerResetStaffPassword(req.staff, req.body)),
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  },
};
