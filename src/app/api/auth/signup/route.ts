import { NextResponse } from "next/server";
import { withRoute, json } from "@/lib/api";
import { signupSchema } from "@/lib/validation/schemas";
import { signup } from "@/lib/services/workspace";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guard";

export const POST = withRoute<{ name: string; email: string; password: string; orgName?: string; inviteCode: string }>(
  async ({ req, ip }) => {
    await assertSameOrigin();
    const body = signupSchema.parse(await req.json());
    const { user, org, session } = await signup(body, { userAgent: req.headers.get("user-agent") ?? undefined, ip: ip ?? undefined });
    await setSessionCookie(session.token, session.expiresAt);
    return json({ user: { id: user.id, email: user.email, name: user.name }, org: { id: org.id, name: org.name, slug: org.slug }, needsProduct: true });
  },
  { name: "auth/signup", rateLimit: { limit: 10, windowSec: 600 } }
);
