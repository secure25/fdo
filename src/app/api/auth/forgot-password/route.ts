import { withRoute, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generatePasswordResetToken } from "@/lib/auth/reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";

const forgotSchema = z.object({
  email: z.string().trim().email(),
});

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const data = forgotSchema.parse(await req.json());
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

