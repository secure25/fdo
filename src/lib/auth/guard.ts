import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { unauthorized, forbidden } from "../errors";
import { getSession, readSessionToken, SESSION_COOKIE, type SessionUser } from "./session";

export type AuthContext = {
  user: SessionUser;
  orgId: string;
  org: { id: string; name: string; slug: string };
  role: string;
  sessionId: string;
};

/** Resolve the current auth context for a server component / service call. Throws 401 AppError if missing. */
export async function getAuth(): Promise<AuthContext> {
  const token = await readSessionToken();
  const session = await getSession(token);
  if (!session) throw unauthorized();

  let orgId = session.orgId;
  if (!orgId) {
    const membership = await prisma.membership.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
    });
    orgId = membership?.orgId ?? null;
    if (orgId) {
      await prisma.session.update({ where: { id: session.id }, data: { orgId } });
    }
  }

  if (!orgId) throw new AuthSetupNeeded();
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.userId, orgId } },
    include: { org: true },
  });
  if (!membership) throw forbidden("No access to this workspace");
  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    orgId: membership.orgId,
    org: { id: membership.org.id, name: membership.org.name, slug: membership.org.slug },
    role: membership.role,
    sessionId: session.id,
  };
}

export class AuthSetupNeeded extends Error {}

/** For server components: redirects to /login instead of throwing. */
export async function requirePage(): Promise<AuthContext> {
  try {
    return await getAuth();
  } catch (e) {
    if (e instanceof AuthSetupNeeded) redirect("/onboarding");
    redirect("/login");
  }
}

/** API-route guard: returns the context or throws AppError (handled by withRoute). */
export async function requireApi(): Promise<AuthContext> {
  return getAuth();
}

/** Origin check for mutations (CSRF defense alongside SameSite=Lax cookies). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // same-origin fetches may omit Origin
  const host = h.get("host");
  try {
    if (new URL(origin).host !== host) throw forbidden("Cross-origin request rejected");
  } catch {
    throw forbidden("Bad origin");
  }
}

export { SESSION_COOKIE };
