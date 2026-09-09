import { env } from "./env";
import { logger } from "./logger";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Dispatches transactional email via Resend's REST API.
 * Uses native fetch — zero external dependencies.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn("RESEND_API_KEY is not set. Simulating transactional email dispatch.", {
      to,
      subject,
    });
    // For local dev / testing: print to console so the reset link is easily accessible
    console.log(
      `\n================= [TRANSACTIONAL EMAIL] =================\n` +
      `To: ${to}\n` +
      `Subject: ${subject}\n` +
      `Content:\n${text || html}\n` +
      `=========================================================\n`
    );
    return { ok: true, id: "simulated" };
  }

  try {
    const from = process.env.EMAIL_FROM || "Founder Distribution OS <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.message || res.statusText || "Resend API error";
      logger.error("Resend email dispatch failed", { to, subject, error: errorMsg });
      return { ok: false, error: errorMsg };
    }

    logger.info("Transactional email sent via Resend", { to, subject, id: data.id });
    return { ok: true, id: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to send transactional email", { to, subject, error: errorMsg });
    return { ok: false, error: errorMsg };
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const subject = "Reset your Founder Distribution OS password";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f1117; color: #ededed; margin: 0; padding: 40px 20px; }
    .card { max-width: 500px; margin: 0 auto; background: #161922; border: 1px solid #232734; border-radius: 8px; padding: 32px; }
    .brand { font-size: 14px; font-weight: 600; color: #818cf8; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; font-weight: 500; font-size: 14px; text-decoration: none; }
    .footer { margin-top: 32px; font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #232734; pt: 16px; }
    .link { color: #818cf8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Founder Distribution OS</div>
    <h1>Reset your password</h1>
    <p>We received a request to reset your password. Click the button below to choose a new password. This link expires in 1 hour.</p>
    <div style="margin-bottom: 24px;">
      <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
    </div>
    <p style="font-size: 12px;">If button doesn't work, copy and paste this URL into your browser:<br><a href="${resetUrl}" class="link">${resetUrl}</a></p>
    <div class="footer">
      If you did not request a password reset, you can safely ignore this email. Your password will not be changed.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Reset your Founder Distribution OS password\n\n` +
    `Click the link below to choose a new password (expires in 1 hour):\n` +
    `${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.`;

  return sendEmail({ to, subject, html, text });
}

