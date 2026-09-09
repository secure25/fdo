import { withRoute, json } from "@/lib/api";
import { assertSameOrigin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { parseTokenUserId, verifyPasswordResetToken } from "@/lib/auth/reset-token";
import { hashPassword } from "@/lib/auth/password";
import { badRequest } from "@/lib/errors";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const data = resetSchema.parse(await req.json());

    const userId = parseTokenUserId(data.token);
    if (!userId) {
      throw badRequest("Invalid or malformed reset token.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw badRequest("User associated with this reset link does not exist.");
    }

    const verification = verifyPasswordResetToken(data.token, user.passwordHash);
    if (!verification.ok) {
      throw badRequest(verification.error ?? "Invalid reset token.");
    }

    const newHash = await hashPassword(data.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      // Invalidate all active sessions for security
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return json({
      ok: true,
      message: "Password updated successfully. You can now sign in with your new password.",
    });
  },
  { name: "auth/reset-password" }
);

