import { cookies } from "next/headers";
import { randomToken, sha256 } from "./password";
import { prisma } from "../db";

export const SESSION_COOKIE = "dos_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function createSession(userId: string, orgId: string | null, meta: { userAgent?: string; ip?: string } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({
    data: {
      userId,
      orgId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300),
      ip: meta.ip?.slice(0, 64),
    },
  });
  return { token, expiresAt };
}

export async function getSession(token: string | undefined | null) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}
