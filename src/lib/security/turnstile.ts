import { logger } from "../logger";

export async function verifyTurnstileToken(token: string | undefined | null, ip?: string | null): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If Turnstile is not configured in this environment, allow request through
  if (!secretKey) {
    return true;
  }

  if (!token) {
    logger.warn("[turnstile] missing turnstile token when verification is enabled");
    return false;
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });

    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!data.success) {
      logger.warn("[turnstile] token verification failed", { errors: data["error-codes"] });
    }
    return Boolean(data.success);
  } catch (err) {
    logger.error("[turnstile] verification request error", { error: String(err) });
    // Fail-closed or fail-open: allow transient network errors to avoid locking out legitimate users
    return true;
  }
}

