import { withRoute, json } from "@/lib/api";
import { destroySession, readSessionToken, clearSessionCookie } from "@/lib/auth/session";

export const POST = withRoute(
  async () => {
    const token = await readSessionToken();
    await destroySession(token);
    await clearSessionCookie();
    return json({ ok: true });
  },
  { name: "auth/logout" }
);
