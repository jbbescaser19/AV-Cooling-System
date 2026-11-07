// Cookies authenticate the customer; a trusted Origin protects checkout writes
// against cross-site form submissions. The browser supplies Origin on POST.
export function requireCustomerWriteOrigin(req, res, next) {
  const allowed = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const origin = req.get("origin");
  if (!origin || origin !== allowed) {
    return res
      .status(403)
      .json({ success: false, message: "Untrusted checkout origin." });
  }
  return next();
}
