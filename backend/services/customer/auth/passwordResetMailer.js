import { sendOtpEmail } from "./otpEmailService.js";

/**
 * Send a branded customer password reset email.
 */
export async function sendPasswordResetEmail(email, code) {
  return sendOtpEmail({
    email,
    code,
    type: "passwordReset",
  });
}
