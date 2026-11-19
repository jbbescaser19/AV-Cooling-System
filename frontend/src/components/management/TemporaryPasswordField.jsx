import { useId, useState } from "react";

import { RefreshCw, Copy, Eye, EyeOff } from "lucide-react";

import PasswordStrength from "../auth/PasswordStrength.jsx";

import { isStrongPassword } from "../../utils/passwordPolicy.js";

import "../../styles/management/temporary-password.css";

function generateTemporaryPassword() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  let password;

  do {
    const bytes = crypto.getRandomValues(new Uint8Array(24));

    password = Array.from(bytes, (byte) => characters[byte & 63]).join("");
  } while (!isStrongPassword(password));

  return password;
}

export default function TemporaryPasswordField({
  value = "",
  onChange,
  mustChangePassword = false,
  onTemporaryChange,
  disabled = false,
}) {
  const inputId = useId();

  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState("");

  function handleGenerate() {
    onChange(generateTemporaryPassword());
    onTemporaryChange(true);

    setNotice("Strong temporary password generated.");
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(value);

      setNotice("Password copied. Share it privately.");
    } catch {
      setVisible(true);

      setNotice("Copy the password manually.");
    }
  }

  return (
    <div className="wsm-field av-temp-password">
      <label htmlFor={inputId}>
        {mustChangePassword ? "Temporary password *" : "Password *"}
      </label>

      <div className="av-temp-password-input">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          placeholder="Enter password"
          value={value}
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setNotice("");
          }}
        />

        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((previous) => !previous)}
          disabled={disabled}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      <div className="av-temp-password-actions">
        <button type="button" onClick={handleGenerate} disabled={disabled}>
          <RefreshCw size={15} />
          Generate password
        </button>

        <button
          type="button"
          onClick={copyPassword}
          disabled={disabled || !isStrongPassword(value)}
        >
          <Copy size={15} />
          Copy password
        </button>
      </div>

      {notice && <small role="status">{notice}</small>}

      <PasswordStrength value={value} />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={mustChangePassword}
          disabled={disabled}
          style={{
            width: "16px",
            height: "16px",
            minHeight: "0",
            flexShrink: 0,
            margin: 0,
          }}
          onChange={(event) => {
            onTemporaryChange(event.target.checked);
            setNotice("");
          }}
        />

        <span>Require password change on first login</span>
      </label>

      <small>
        {mustChangePassword
          ? "Staff must change this temporary password after their first login."
          : "Staff can log in normally without being required to change their password."}
      </small>
    </div>
  );
}
