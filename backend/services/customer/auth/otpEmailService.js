/**
 * Shared HTML and plain-text OTP emails.
 * Used for registration and password recovery.
 */

const EMAIL_TYPES = {
  registration: {
    subject: "Verify your email | AV Cooling System",
    eyebrow: "EMAIL VERIFICATION",
    heading: "Verify your email",
    introduction:
      "You're almost done creating your AV Cooling System account. " +
      "Enter the code below on the registration page to verify your email address.",
    notice:
      "If you did not request an AV Cooling account, " +
      "you can safely ignore this email.",
  },

  passwordReset: {
    subject: "Reset your password | AV Cooling System",
    eyebrow: "PASSWORD RECOVERY",
    heading: "Reset your password",
    introduction:
      "We received a request to reset your AV Cooling System password. " +
      "Enter the code below on the password reset page to continue.",
    notice:
      "If you did not request a password reset, " +
      "you can safely ignore this email. Your password will not change.",
  },
};

function serviceUnavailable() {
  return Object.assign(
    new Error("Verification email could not be sent. Please try again later."),
    { status: 503 },
  );
}

function buildEmail(type, code) {
  const content = EMAIL_TYPES[type];

  if (!content || !/^\d{6}$/.test(code)) {
    throw new TypeError("Invalid OTP email content.");
  }

  const text = [
    "AV COOLING SYSTEM",
    content.heading,
    "",
    content.introduction,
    "",
    `Your verification code: ${code}`,
    "This code expires in 10 minutes.",
    "",
    "Do not share this code with anyone, including AV Cooling staff.",
    content.notice,
    "",
    "AV Cooling System | Automated account security email",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${content.subject}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#eff4f9;
  color:#18324b;
  font-family:Arial,Helvetica,sans-serif;
">
  <div style="
    display:none;
    font-size:1px;
    color:#eff4f9;
    line-height:1px;
    max-height:0;
    max-width:0;
    opacity:0;
    overflow:hidden;
  ">
    Your AV Cooling System ${
      type === "registration" ? "registration" : "password reset"
    } code is inside. Expires in 10 minutes.
  </div>

  <table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
    style="
      border-collapse:collapse;
      background-color:#eff4f9;
    "
  >
    <tr>
      <td align="center" style="padding:32px 14px;">

        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          style="
            width:100%;
            max-width:580px;
            border-collapse:separate;
            background-color:#ffffff;
            border-radius:18px;
            overflow:hidden;
          "
        >

          <!-- BRAND HEADER -->
          <tr>
            <td style="
              background-color:#102b45;
              padding:27px 28px;
            ">
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="border-collapse:collapse;"
              >
                <tr>
                  <td
                    valign="middle"
                    align="center"
                    style="
                      width:48px;
                      height:48px;
                      background-color:#ffffff;
                      border-radius:12px;
                      color:#102b45;
                      font-size:19px;
                      font-weight:800;
                      letter-spacing:-1px;
                    "
                  >
                    AV
                  </td>

                  <td
                    valign="middle"
                    style="padding-left:14px;"
                  >
                    <div style="
                      font-size:17px;
                      font-weight:700;
                      line-height:24px;
                      letter-spacing:.3px;
                      color:#ffffff;
                    ">
                      AV Cooling System
                    </div>

                    <div style="
                      font-size:11px;
                      line-height:18px;
                      letter-spacing:1.7px;
                      color:#b9d9ee;
                    ">
                      ACCOUNT SECURITY
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- EMAIL HEADING -->
          <tr>
            <td style="padding:32px 28px 10px;">

              <div style="
                font-size:11px;
                font-weight:700;
                letter-spacing:1.8px;
                color:#087fa1;
              ">
                ${content.eyebrow}
              </div>

              <h1 style="
                margin:10px 0 14px;
                font-size:26px;
                line-height:1.25;
                font-weight:700;
                color:#102b45;
              ">
                ${content.heading}
              </h1>

              <p style="
                margin:0;
                font-size:15px;
                line-height:1.7;
                color:#526779;
              ">
                ${content.introduction}
              </p>

            </td>
          </tr>

          <!-- HIGHLIGHTED OTP -->
          <tr>
            <td style="padding:22px 28px 18px;">

              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                style="
                  border-collapse:separate;
                  background-color:#edf7fd;
                  border:1px solid #b8e1f4;
                  border-radius:13px;
                "
              >
                <tr>
                  <td
                    align="center"
                    style="padding:22px 10px 19px;"
                  >

                    <div style="
                      font-size:11px;
                      font-weight:700;
                      letter-spacing:1.6px;
                      color:#37617d;
                    ">
                      YOUR 6-DIGIT CODE
                    </div>

                    <div style="
                      padding:10px 0 8px;
                      font-size:34px;
                      line-height:44px;
                      letter-spacing:7px;
                      font-weight:800;
                      color:#103d67;
                      font-variant-numeric:tabular-nums;
                      white-space:nowrap;
                    ">
                      ${code}
                    </div>

                    <div style="
                      font-size:13px;
                      line-height:20px;
                      color:#37617d;
                    ">
                      Expires in <strong>10 minutes</strong>
                    </div>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- SECURITY MESSAGE -->
          <tr>
            <td style="padding:0 28px 32px;">

              <p style="
                margin:0 0 8px;
                font-size:14px;
                line-height:1.65;
                color:#334b5f;
              ">
                <strong>Keep your account secure.</strong>
                Never share this code with anyone,
                including AV Cooling staff.
              </p>

              <p style="
                margin:0;
                font-size:13px;
                line-height:1.65;
                color:#708296;
              ">
                ${content.notice}
              </p>

            </td>
          </tr>

        </table>

        <!-- FOOTER -->
        <p style="
          max-width:580px;
          margin:18px 0 0;
          font-size:12px;
          line-height:1.6;
          color:#708296;
        ">
          AV Cooling System &bull;
          Automated account security email
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: content.subject,
    text,
    html,
  };
}

export async function sendOtpEmail({ email, code, type }) {
  const { subject, text, html } = buildEmail(type, code);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REGISTRATION_EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("OTP email delivery configuration missing.", { type });

    throw serviceUnavailable();
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), 10000);

  let response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text,
      }),
    });
  } catch (error) {
    console.error("OTP email provider unreachable.", {
      type,
      reason: error.name === "AbortError" ? "Timeout" : "Connection error",
    });

    throw serviceUnavailable();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error("OTP email provider rejected request.", {
      type,
      httpStatus: response.status,
    });

    throw serviceUnavailable();
  }
}
