import {
  createHostedCheckout,
  recordPaymongoPaidEvent,
  verifyPaymongoSignature,
} from "../../services/payments/paymongoService.js";

function respondError(res, error) {
  const code = Number(error?.status);
  const status = code >= 400 && code < 600 ? code : 500;
  if (status === 500) console.error("PayMongo operation failed:", error);
  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Payment service is temporarily unavailable."
        : error.message,
  });
}

export async function customerCheckoutController(req, res) {
  try {
    const kind = req.body?.kind;
    const identifier = req.body?.identifier;
    const result = await createHostedCheckout({
      kind,
      identifier,
      actor: { type: "CUSTOMER", id: req.auth.userId },
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function staffCheckoutController(req, res) {
  try {
    const { kind, identifier } = req.body || {};
    const result = await createHostedCheckout({
      kind,
      identifier,
      actor: { type: "STAFF", id: req.staff.id, role: req.staff.role },
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function paymongoWebhookController(req, res) {
  try {
    if (!verifyPaymongoSignature(req.body, req.headers["paymongo-signature"])) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid payment notification." });
    }
    const result = await recordPaymongoPaidEvent(
      JSON.parse(req.body.toString("utf8")),
    );
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondError(res, error);
  }
}
