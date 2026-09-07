import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const { currentPassword, newPassword } = schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!user) throw badRequest("Session user not found");
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw badRequest("Current password is incorrect");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    return json({ ok: true });
  },
  { name: "auth/password", rateLimit: { limit: 5, windowSec: 600 } }
);
