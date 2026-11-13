import {
  customerDeletionPreview,
  deleteCustomerAccount,
} from "../../../services/management/customers/customerDeletionService.js";

function respond(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req);
      return res.json({ success: true, ...result });
    } catch (error) {
      const status =
        Number(error.status) >= 400 && Number(error.status) < 500
          ? Number(error.status)
          : 500;
      if (status === 500) console.error("Customer account deletion:", error);
      return res.status(status).json({
        success: false,
        message:
          status === 500
            ? "Account deletion could not be completed. No changes were saved."
            : error.message,
      });
    }
  };
}

export const previewCustomerDeletionController = respond((req) =>
  customerDeletionPreview(req.staff, req.params.id),
);
export const deleteCustomerAccountController = respond((req) =>
  deleteCustomerAccount(req.staff, req.params.id, req.body),
);
