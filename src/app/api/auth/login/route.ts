import { withRoute, json } from "@/lib/api";
import { loginSchema } from "@/lib/validation/schemas";
import { login } from "@/lib/services/workspace";
import { setSessionCookie } from "@/lib/auth/session";

export const POST = withRoute(
  async ({ req, ip }) => {
    const body = loginSchema.parse(await req.json());
    const { user, orgId, session } = await login(body.email, body.password, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: ip ?? undefined,
    });
    await setSessionCookie(session.token, session.expiresAt);
    return json({ user: { id: user.id, email: user.email, name: user.name }, orgId, needsProduct: orgId === null });
  },
  { name: "auth/login", rateLimit: { limit: 12, windowSec: 300 } }
);
