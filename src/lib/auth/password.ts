import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** API keys: sk-dos-<prefix>-<secret>. Only the SHA-256 hash is stored. */
import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const full = `sk-dos-${prefix}-${secret}`;
  return { full, prefix: `sk-dos-${prefix}`, hash: sha256(full) };
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
