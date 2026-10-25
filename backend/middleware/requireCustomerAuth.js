import jwt from "jsonwebtoken";

export function requireCustomerAuth(req, res, next) {
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!process.env.ACCESS_SECRET) {
    console.error("ACCESS_SECRET is not configured.");

    return res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
  }

  try {
    const payload = jwt.verify(accessToken, process.env.ACCESS_SECRET);

    const userId = payload.sub ?? payload.userId ?? payload.user_id;

    const accountType = String(
      payload.accountType ?? payload.account_type ?? "",
    ).toUpperCase();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    if (accountType !== "CUSTOMER") {
      return res.status(403).json({
        success: false,
        message: "Customer access is required.",
      });
    }

    req.auth = {
      userId: String(userId),
      accountType,
      role: payload.role ?? null,
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }
}
