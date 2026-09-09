import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../env";

/**
 * Generates an HMAC-SHA256 signed password reset token.
 * Contains: userId, expiry timestamp, and the first 16 chars of current passwordHash.
 * If user changes password, previous tokens are immediately invalidated automatically.
 */
export function generatePasswordResetToken(userId: string, currentPasswordHash: string): string {
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour validity
  const payload = `${userId}:${expiresAt}:${currentPasswordHash.slice(0, 16)}`;
  const hmac = createHmac("sha256", env.authSecret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

export function parseTokenUserId(token: string): string | null {
  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const [userId] = payload.split(":");
    return userId || null;
  } catch {
    return null;
  }
}

export function verifyPasswordResetToken(
  token: string,
  currentPasswordHash: string
): { ok: boolean; userId?: string; error?: string } {
  try {
    const [payloadB64, hmac] = token.split(".");
    if (!payloadB64 || !hmac) return { ok: false, error: "Invalid token structure" };

    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const [userId, expiresAtStr, hashSlice] = payload.split(":");
    if (!userId || !expiresAtStr || !hashSlice) {
      return { ok: false, error: "Malformed token data" };
    }

    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) {
      return { ok: false, error: "This password reset link has expired. Please request a new one." };
    }

    // Verify hash slice matches user's current password hash
    if (hashSlice !== currentPasswordHash.slice(0, 16)) {
      return { ok: false, error: "This reset link has already been used or is no longer valid." };
    }

    const expectedHmac = createHmac("sha256", env.authSecret).update(payload).digest("base64url");
    const hmacBuf = Buffer.from(hmac);
    const expectedBuf = Buffer.from(expectedHmac);

    if (hmacBuf.length !== expectedBuf.length || !timingSafeEqual(hmacBuf, expectedBuf)) {
      return { ok: false, error: "Invalid reset token signature" };
    }

    return { ok: true, userId };
  } catch {
    return { ok: false, error: "Corrupted or unreadable reset token" };
  }
}

