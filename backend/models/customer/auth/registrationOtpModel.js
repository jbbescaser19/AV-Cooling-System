export function registrationOtpModel(db) {
  return {
    async lockPending(email) {
      const [rows] = await db.execute(
        `SELECT email, full_name AS fullName, phone, password_hash AS passwordHash,
                otp_hash AS otpHash, expires_at AS expiresAt, resend_after AS resendAfter,
                window_started_at AS windowStartedAt, sends_in_window AS sendsInWindow,
                failed_attempts AS failedAttempts
           FROM customer_registration_otps WHERE email = ? FOR UPDATE`,
        [email],
      );
      return rows[0] ?? null;
    },
    async savePending({
      email,
      fullName,
      phone,
      passwordHash,
      otpHash,
      expiresAt,
      resendAfter,
      windowStartedAt,
      sendsInWindow,
    }) {
      await db.execute(
        `INSERT INTO customer_registration_otps
          (email, full_name, phone, password_hash, otp_hash, expires_at, resend_after, window_started_at, sends_in_window, failed_attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
          full_name=VALUES(full_name), phone=VALUES(phone), password_hash=VALUES(password_hash),
          otp_hash=VALUES(otp_hash), expires_at=VALUES(expires_at),
          resend_after=VALUES(resend_after), window_started_at=VALUES(window_started_at),
          sends_in_window=VALUES(sends_in_window), failed_attempts=0`,
        [
          email,
          fullName,
          phone,
          passwordHash,
          otpHash,
          expiresAt,
          resendAfter,
          windowStartedAt,
          sendsInWindow,
        ],
      );
    },
    async recordFailure(email) {
      await db.execute(
        `UPDATE customer_registration_otps SET failed_attempts=failed_attempts+1 WHERE email=?`,
        [email],
      );
    },
    async deletePending(email) {
      await db.execute(`DELETE FROM customer_registration_otps WHERE email=?`, [
        email,
      ]);
    },
    async deleteUnsent(email, digest) {
      await db.execute(
        `DELETE FROM customer_registration_otps WHERE email=? AND otp_hash=?`,
        [email, digest],
      );
    },
    async countIpRequest(ipHash, now) {
      // Reset the hour window atomically, then read count under the same row lock.
      await db.execute(
        `INSERT INTO customer_registration_otp_rate_limits
          (ip_hash, window_started_at, request_count) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
          request_count=IF(window_started_at < DATE_SUB(VALUES(window_started_at), INTERVAL 1 HOUR), 1, request_count+1),
          window_started_at=IF(window_started_at < DATE_SUB(VALUES(window_started_at), INTERVAL 1 HOUR), VALUES(window_started_at), window_started_at)`,
        [ipHash, now],
      );
      const [rows] = await db.execute(
        `SELECT request_count AS requestCount FROM customer_registration_otp_rate_limits WHERE ip_hash=? FOR UPDATE`,
        [ipHash],
      );
      return Number(rows[0]?.requestCount ?? 0);
    },
  };
}
