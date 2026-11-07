// Cookie-authenticated mutations must come from the configured frontend origin.

export function requireServiceWriteOrigin(req, res, next) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  if (req.get("origin") !== allowedOrigin || !req.is("application/json")) {
    return res.status(403).json({
      success: false,
      message: "Request origin or content type is not allowed.",
    });
  }

  return next();
}
