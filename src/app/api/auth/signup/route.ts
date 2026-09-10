import { NextResponse } from "next/server";
import { withRoute, json } from "@/lib/api";
import { signupSchema } from "@/lib/validation/schemas";
import { signup } from "@/lib/services/workspace";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guard";
import { protectWithArcjet } from "@/lib/security/arcjet";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const POST = withRoute<{ name: string; email: string; password: string; orgName?: string; inviteCode: string }>(
  async ({ req, ip }) => {
    await assertSameOrigin();

    // 1. Arcjet protection
    const arcjetResult = await protectWithArcjet(req);
    if (!arcjetResult.ok) {
      return json({ error: { code: "ACCESS_DENIED", message: arcjetResult.message } }, { status: arcjetResult.status });
    }

    const rawBody = await req.json();

    // 2. Cloudflare Turnstile token verification
    const isHuman = await verifyTurnstileToken(rawBody.turnstileToken, ip);
    if (!isHuman) {
      return json({ error: { code: "BOT_DETECTED", message: "Security verification failed. Please try again." } }, { status: 403 });
    }

    const body = signupSchema.parse(rawBody);
    const { user, org, session } = await signup(body, { userAgent: req.headers.get("user-agent") ?? undefined, ip: ip ?? undefined });
    await setSessionCookie(session.token, session.expiresAt);
    return json({ user: { id: user.id, email: user.email, name: user.name }, org: { id: org.id, name: org.name, slug: org.slug }, needsProduct: true });
  },
  { name: "auth/signup", rateLimit: { limit: 10, windowSec: 600 } }
);
