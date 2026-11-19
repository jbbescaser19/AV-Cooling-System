export function getPasswordChecks(value = "") {
  const password = String(value ?? "");

  return [
    {
      label: "At least 12 characters",
      met: Array.from(password).length >= 12,
    },
    {
      label: "Uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "Number",
      met: /[0-9]/.test(password),
    },
    {
      label: "Special character",
      met: /[^\p{L}\p{N}\s]/u.test(password),
    },
    {
      label: "No obvious password patterns",
      met:
        Boolean(password) &&
        !/password|qwerty|123456|av[\s_-]*cooling|letmein|admin123/i.test(
          password,
        ),
    },
    {
      label: "Within 72-byte limit",
      met: Boolean(password) && new TextEncoder().encode(password).length <= 72,
    },
  ];
}

export function isStrongPassword(value) {
  return getPasswordChecks(value).every((check) => check.met);
}
