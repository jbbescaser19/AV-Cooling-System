import { confirmServiceCashRefund } from "../../../services/management/sales/serviceRefundService.js";

export async function confirmServiceCashRefundController(req, res) {
  try {
    const result = await confirmServiceCashRefund(
      req.staff,
      req.params.paymentId,
      req.body,
    );
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error("Confirm service cash refund:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Could not record the refund." : error.message,
    });
  }
}
