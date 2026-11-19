import { readFileSync, writeFileSync, existsSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

const imports =
  'import PasswordStrength from "../../components/auth/PasswordStrength.jsx";\n' +
  'import { isStrongPassword } from "../../utils/passwordPolicy.js";\n';

const changes = [];

function replaceOnce(source, pattern, replacement) {
  const matches = [...source.matchAll(pattern)];

  if (matches.length !== 1) {
    throw new Error(`Expected one match (${matches.length} found): ${pattern}`);
  }

  return source.replace(pattern, replacement);
}

function passwordCheck(source, value) {
  return replaceOnce(
    source,
    /if\s*\(\s*(?:formData\.password|form\.newPassword|password)\.length\s*<\s*8\s*\)\s*\{\s*setError\([\s\S]*?\);\s*return;\s*\}/g,
    `if (!isStrongPassword(${value})) {
      setError("Your password must meet all requirements.");
      return;
    }`,
  );
}

function indicatorAfterInput(source, marker, value) {
  const at = source.indexOf(marker);

  if (at < 0 || source.indexOf(marker, at + marker.length) >= 0) {
    throw new Error(`Password field not found uniquely: ${marker}`);
  }

  const start = source.lastIndexOf("<input", at);
  const end = source.indexOf("/>", at);

  if (start < 0 || end < 0) {
    throw new Error("Password input not found.");
  }

  return (
    source.slice(0, end + 2) +
    `\n            <PasswordStrength value={${value}} />` +
    source.slice(end + 2)
  );
}

function update(path, transform) {
  const target = join(root, path);
  const original = readFileSync(target, "utf8");
  const source = original.replace(/\r\n/g, "\n");

  if (source.includes("import PasswordStrength from")) {
    if (
      !source.includes("<PasswordStrength") ||
      !source.includes("isStrongPassword(")
    ) {
      throw new Error(`Incomplete previous installation: ${path}`);
    }

    console.log(`Already installed: ${path}`);
    return;
  }

  let next;

  try {
    next = imports + transform(source);
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }

  changes.push({
    target,
    original,
    next,
    path,
  });
}

try {
  // CUSTOMER REGISTRATION

  update("src/pages/auth/RegisterPage.jsx", (s) => {
    s = passwordCheck(s, "formData.password");

    s = s
      .replaceAll("At least 8 characters", "At least 12 characters")
      .replaceAll("minLength={8}", "minLength={12}");

    s = replaceOnce(
      s,
      /(\{showPassword\s*\?\s*<EyeOff\s+size=\{18\}\s*\/>\s*:\s*<Eye\s+size=\{18\}\s*\/>\s*\}\s*<\/button>\s*<\/div>)/g,
      "$1\n          <PasswordStrength value={formData.password} />",
    );

    return replaceOnce(
      s,
      /disabled=\{\s*loading\s*\|\|\s*!acceptTerms\s*\}/g,
      "disabled={loading || !acceptTerms || !isStrongPassword(formData.password)}",
    );
  });

  // FORGOT PASSWORD

  update("src/pages/auth/ForgotPasswordPage.jsx", (s) => {
    s = passwordCheck(s, "password").replaceAll(
      "minLength={8}",
      "minLength={12}",
    );

    s = indicatorAfterInput(s, 'id="recovery-password"', "password");

    return replaceOnce(
      s,
      /type="submit"\s+disabled=\{busy\}/g,
      'type="submit" disabled={busy || (step === "verify" && (!isStrongPassword(password) || password !== confirm))}',
    );
  });

  // CUSTOMER CHANGE PASSWORD

  update("src/pages/customer/ChangePasswordPage.jsx", (s) => {
    s = passwordCheck(s, "form.newPassword")
      .replace(
        /choose a new password with at\s+least 8 characters\./gi,
        "Choose a new password that meets all requirements below.",
      )
      .replaceAll("minLength={8}", "minLength={12}");

    s = indicatorAfterInput(
      s,
      'id="customer-new-password"',
      "form.newPassword",
    );

    return replaceOnce(
      s,
      /(className="btn btn-dark customer-password-submit"\s+)disabled=\{saving\}/g,
      "$1disabled={saving || !isStrongPassword(form.newPassword) || form.newPassword !== form.confirmPassword}",
    );
  });

  // MANAGEMENT CHANGE PASSWORD

  update("src/pages/management/ManagementChangePasswordPage.jsx", (s) => {
    s = passwordCheck(s, "form.newPassword").replaceAll(
      "minLength={8}",
      "minLength={12}",
    );

    s = indicatorAfterInput(s, "value={form.newPassword}", "form.newPassword");

    return replaceOnce(
      s,
      /type="submit"\s+disabled=\{busy\}/g,
      'type="submit" disabled={busy || !isStrongPassword(form.newPassword) || form.newPassword !== form.confirmPassword}',
    );
  });

  // STAFF ACCOUNT CREATION

  update("src/pages/management/ManagementWorkspacePage.jsx", (s) => {
    s = replaceOnce(
      s,
      /(autoComplete=\{field\.type\s*===\s*"password"\s*\?\s*"new-password"\s*:\s*undefined\}\s*onChange=\{\(event\)\s*=>\s*onChange\(field\.key,\s*event\.target\.value\)\}\s*\/>\s*\)\})\s*<\/label>/g,
      `$1
      {module === "staff" && field.type === "password" && field.key === "password" && (
        <PasswordStrength value={value ?? ""} />
      )}
    </label>`,
    );

    s = replaceOnce(
      s,
      /(<form\b[^>]*?\bonSubmit=)\{submit\}/g,
      `$1{(event) => {
          if (module === "staff" && isNew && !isStrongPassword(form.password)) {
            event.preventDefault();
            setError("Your password must meet all requirements.");
            return;
          }

          return submit(event);
        }}`,
    );

    return replaceOnce(
      s,
      /(className="wsm-primary"\s+disabled=\{\s*)/g,
      `$1(module === "staff" && isNew && !isStrongPassword(form.password)) ||
                `,
    );
  });

  // CHECK BACKUPS BEFORE MODIFYING FILES

  for (const { target } of changes) {
    if (existsSync(`${target}.password-backup`)) {
      throw new Error(`Existing backup: ${target}.password-backup`);
    }
  }

  // CREATE BACKUPS

  for (const { target, original } of changes) {
    writeFileSync(`${target}.password-backup`, original, { flag: "wx" });
  }

  // APPLY CHANGES

  const written = [];

  try {
    for (const { target, original, next, path } of changes) {
      written.push({ target, original });

      writeFileSync(target, next);

      console.log(`Updated: ${path}`);
    }
  } catch (error) {
    for (const { target, original } of written) {
      writeFileSync(target, original);
    }

    throw error;
  }

  console.log("Password strength integration complete.");
} catch (error) {
  console.error("Installation stopped:", error.message);

  process.exitCode = 1;
}
