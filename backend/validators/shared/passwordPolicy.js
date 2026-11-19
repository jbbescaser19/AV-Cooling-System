import { z } from "zod";

export const PASSWORD_REQUIREMENTS =
  "Use at least 12 characters, including an uppercase letter, a lowercase letter, a number, and a special character.";

const obviousPassword =
  /password|qwerty|123456|av[\s_-]*cooling|letmein|admin123/i;

export const strongPassword = z.string().superRefine((value, context) => {
  let message = "";

  if (Buffer.byteLength(value, "utf8") > 72) {
    message = "Password must not exceed 72 bytes.";
  } else if (
    Array.from(value).length < 12 ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^\p{L}\p{N}\s]/u.test(value)
  ) {
    message = PASSWORD_REQUIREMENTS;
  } else if (obviousPassword.test(value)) {
    message =
      "Choose a less predictable password. Avoid common passwords and the business name.";
  }

  if (message) {
    context.addIssue({
      code: "custom",
      message,
    });
  }
});
