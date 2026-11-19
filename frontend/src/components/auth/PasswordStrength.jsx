import { CheckCircle2, Circle } from "lucide-react";

import { getPasswordChecks } from "../../utils/passwordPolicy.js";

import "../../styles/auth/password-strength.css";

export default function PasswordStrength({ value = "" }) {
  const checks = getPasswordChecks(value);

  const passed = checks.filter((check) => check.met).length;

  const strong = checks.every((check) => check.met);

  const level = !value
    ? "empty"
    : strong
      ? "strong"
      : passed >= 4
        ? "moderate"
        : "weak";

  const labels = {
    empty: "Enter password",
    weak: "Weak",
    moderate: "Moderate",
    strong: "Strong",
  };

  const scores = {
    empty: 0,
    weak: 1,
    moderate: 2,
    strong: 3,
  };

  return (
    <span className="av-password-strength" data-level={level}>
      <span className="av-password-strength-header">
        <strong>Password strength</strong>

        <strong className="av-password-strength-status" aria-live="polite">
          {labels[level]}
        </strong>
      </span>

      <span
        className="av-password-strength-bar"
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={scores[level]}
        aria-valuetext={labels[level]}
      >
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={segment <= scores[level] ? "is-filled" : ""}
          />
        ))}
      </span>

      <span className="av-password-requirements">
        {checks.map((check) => (
          <span
            key={check.label}
            className={`av-password-rule ${check.met ? "is-met" : ""}`}
            aria-label={`${check.label}: ${check.met ? "met" : "not met"}`}
          >
            {check.met ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <Circle size={15} aria-hidden="true" />
            )}

            <span>{check.label}</span>
          </span>
        ))}
      </span>

      <span className="av-password-strength-message">
        {strong
          ? "Password meets all requirements."
          : value
            ? "Password does not meet all requirements."
            : "Create a strong and unique password."}
      </span>
    </span>
  );
}
