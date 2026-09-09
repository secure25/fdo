import { describe, expect, it } from "vitest";
import {
  generatePasswordResetToken,
  parseTokenUserId,
  verifyPasswordResetToken,
} from "@/lib/auth/reset-token";

describe("Password Reset Token System", () => {
  const userId = "cuid_user_12345";
  const passwordHash = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890";

  it("generates a signed reset token containing userId", () => {
    const token = generatePasswordResetToken(userId, passwordHash);
    expect(token).toBeTruthy();
    expect(token.includes(".")).toBe(true);

    const parsedId = parseTokenUserId(token);
    expect(parsedId).toBe(userId);
  });

  it("verifies a valid token successfully", () => {
    const token = generatePasswordResetToken(userId, passwordHash);
    const result = verifyPasswordResetToken(token, passwordHash);
    expect(result.ok).toBe(true);
    expect(result.userId).toBe(userId);
  });

  it("rejects token if password has changed (hash slice mismatch)", () => {
    const token = generatePasswordResetToken(userId, passwordHash);
    const newPasswordHash = "$2a$10$differenthashcontent9876543210zyxwv";

    const result = verifyPasswordResetToken(token, newPasswordHash);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("no longer valid");
  });

  it("rejects tampered or forged tokens", () => {
    const token = generatePasswordResetToken(userId, passwordHash);
    const [payload, hmac] = token.split(".");
    // Tamper with HMAC
    const tampered = `${payload}.${hmac.slice(0, -4)}abcd`;

    const result = verifyPasswordResetToken(tampered, passwordHash);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid reset token signature");
  });
});

