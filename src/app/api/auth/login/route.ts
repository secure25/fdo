import { withRoute, json } from "@/lib/api";
import { loginSchema } from "@/lib/validation/schemas";
import { login } from "@/lib/services/workspace";
import { setSessionCookie } from "@/lib/auth/session";
import { protectWithArcjet } from "@/lib/security/arcjet";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const POST = withRoute(
  async ({ req, ip }) => {
    // 1. Arcjet bot and rate defense
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

    const body = loginSchema.parse(rawBody);
    const { user, orgId, session } = await login(body.email, body.password, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: ip ?? undefined,
    });
    await setSessionCookie(session.token, session.expiresAt);
    return json({ user: { id: user.id, email: user.email, name: user.name }, orgId, needsProduct: orgId === null });
  },
  { name: "auth/login", rateLimit: { limit: 12, windowSec: 300 } }
);
