import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { resolveEffectivePlan } from "@/lib/entitlements";
import { teamInviteSchema } from "@/lib/validation/schemas";
import { hashPassword, randomToken } from "@/lib/auth/password";
import { badRequest, forbidden } from "@/lib/errors";

export const GET = withRoute(
  async () => {
    const auth = await requireApi();
    const [members, plan] = await Promise.all([
      prisma.membership.findMany({
        where: { orgId: auth.orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      resolveEffectivePlan(auth.orgId),
    ]);

    return json({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        user: m.user,
      })),
      seatsUsed: members.length,
      seatsMax: plan.limits.seats,
      planName: plan.name,
    });
  },
  { name: "team/list" }
);

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();

    if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
      throw forbidden("Only workspace owners or admins can invite team members.");
    }

    const data = teamInviteSchema.parse(await req.json());
    const email = data.email.toLowerCase().trim();

    const plan = await resolveEffectivePlan(auth.orgId);
    const seatsUsed = await prisma.membership.count({ where: { orgId: auth.orgId } });

    if (seatsUsed >= plan.limits.seats) {
      throw forbidden(
        `Seat limit reached (${seatsUsed}/${plan.limits.seats} seats used on ${plan.name} plan). Upgrade your plan to invite more team members.`
      );
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const initialPassword = randomToken(16);
      const passwordHash = await hashPassword(initialPassword);
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          passwordHash,
        },
      });
    }

    // Check if already member
    const existingMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: auth.orgId } },
    });

    if (existingMembership) {
      throw badRequest("This user is already a member of this workspace.");
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        orgId: auth.orgId,
        role: data.role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return json({
      ok: true,
      member: {
        id: membership.id,
        role: membership.role,
        createdAt: membership.createdAt.toISOString(),
        user: membership.user,
      },
      isNewUser,
    });
  },
  { name: "team/invite" }
);

export const DELETE = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();

    if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
      throw forbidden("Only workspace owners or admins can remove team members.");
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("id");
    if (!memberId) throw badRequest("Missing member id");

    const membership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.orgId !== auth.orgId) {
      throw badRequest("Member not found in this workspace");
    }

    if (membership.role === "OWNER") {
      const ownerCount = await prisma.membership.count({
        where: { orgId: auth.orgId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw forbidden("Cannot remove the primary workspace owner.");
      }
    }

    await prisma.membership.delete({ where: { id: memberId } });

    return json({ ok: true });
  },
  { name: "team/remove" }
);

