import { withRoute, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generatePasswordResetToken } from "@/lib/auth/reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { protectWithArcjet } from "@/lib/security/arcjet";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { z } from "zod";

const forgotSchema = z.object({
  email: z.string().trim().email(),
  turnstileToken: z.string().optional(),
});

export const POST = withRoute(
  async ({ req, ip }) => {
    await assertSameOrigin();

    // 1. Arcjet protection
    const arcjetResult = await protectWithArcjet(req);
    if (!arcjetResult.ok) {
      return json({ error: { code: "ACCESS_DENIED", message: arcjetResult.message } }, { status: arcjetResult.status });
    }

    const rawBody = await req.json();

    // 2. Cloudflare Turnstile verification
    const isHuman = await verifyTurnstileToken(rawBody.turnstileToken, ip);
    if (!isHuman) {
      return json({ error: { code: "BOT_DETECTED", message: "Security verification failed. Please try again." } }, { status: 403 });
    }

    const data = forgotSchema.parse(rawBody);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = generatePasswordResetToken(user.id, user.passwordHash);
      const baseUrl = env.appUrl.replace(/\/$/, "");
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
      });
    }

    return json({
      ok: true,
      message: "If an account with that email exists, we sent a password reset link.",
    });
  },
  { name: "auth/forgot-password" }
);

