import {
  staffDeletionPreview,
  deleteStaffAccount,
} from "../../../services/management/administration/staffAccountDeletionService.js";

function respond(action) {
  return async (req, res) => {
    try {
      return res.json({ success: true, ...(await action(req)) });
    } catch (error) {
      const status =
        Number(error.status) >= 400 && Number(error.status) < 500
          ? Number(error.status)
          : 500;
      if (status === 500) console.error("Staff account deletion:", error);
      return res.status(status).json({
        success: false,
        message:
          status === 500
            ? "Staff account deletion failed. No changes were saved."
            : error.message,
      });
    }
  };
}
export const previewStaffDeletionController = respond((req) =>
  staffDeletionPreview(req.staff, req.params.id),
);
export const deleteStaffAccountController = respond((req) =>
  deleteStaffAccount(req.staff, req.params.id, req.body),
);
