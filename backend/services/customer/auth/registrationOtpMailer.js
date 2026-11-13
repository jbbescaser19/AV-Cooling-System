import { sendOtpEmail } from "./otpEmailService.js";

/**
 * Send a branded registration verification email.
 */
export async function sendRegistrationOtpEmail(email, code) {
  return sendOtpEmail({
    email,
    code,
    type: "registration",
  });
}
