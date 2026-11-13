import { z } from "zod";
import { personName } from "../../shared/personFields.js";
import { validateRegister } from "../../../utils/validateAndSanitize.js";

const OTP_REGEX = /^[0-9]{6}$/;
const emailSchema = z.string().trim().email().max(255);

export function validateOtpRegistration(input) {
  const registration = validateRegister(input);
  if (!registration.success) {
    const error = new Error(registration.errors.join(" "));
    error.status = 400;
    throw error;
  }
  const { fullName, email, phone, password } = registration.data;
  if (
    email.length > 255 ||
    phone.length > 30 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    const error = new Error(
      "Email or phone is too long, or password exceeds the 72-byte limit.",
    );
    error.status = 400;
    throw error;
  }
  const nameResult = personName.safeParse(fullName);
  if (!nameResult.success) {
    const error = new Error(
      nameResult.error.issues[0]?.message || "Enter a valid full name.",
    );
    error.status = 400;
    throw error;
  }
  if (!/^(?:\+63|0)9\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
    const error = new Error(
      "Enter a valid Philippine mobile number, such as 09XXXXXXXXX.",
    );
    error.status = 400;
    throw error;
  }
  return registration.data;
}

export function validateOtpVerification(input) {
  const parsed = z
    .object({ email: emailSchema, otp: z.string().regex(OTP_REGEX) })
    .safeParse(input);
  if (!parsed.success) {
    const error = new Error(
      "Enter your registered email and the six-digit verification code.",
    );
    error.status = 400;
    throw error;
  }
  return { email: parsed.data.email.toLowerCase(), otp: parsed.data.otp };
}
