/**
 * Workspace service — signup, org provisioning, community catalog seeding.
 */

import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";
import { conflict, unauthorized } from "../errors";
import { slugify } from "../utils";
import { COMMUNITIES } from "../engines/taxonomy";
import { ensureSubscription } from "../usage";
import { enqueueJob } from "../jobs/queue";
import { jstr } from "../jsonfield";

/** Idempotently ensure the global community catalog exists. */
export async function ensureCommunities() {
  const existing = await prisma.community.count();
  if (existing >= COMMUNITIES.length) return;
  for (const c of COMMUNITIES) {
    await prisma.community.upsert({
      where: { id: `${c.key}` },
      update: {},
      create: {
        id: c.key,
        platform: c.platform,
        name: c.name,
        url: c.url,
        focus: c.focus,
        memberEstimate: c.memberEstimate,
        rules: jstr(c.rules),
        archetypeTags: jstr(c.archetypeTags),
      },
    }).catch(async () => {
      // id may conflict with cuid format assumptions; fall back to create-if-missing
      const found = await prisma.community.findUnique({ where: { id: c.key } });
      if (!found) throw new Error(`community seed failed for ${c.key}`);
    });
  }
}

export async function signup(input: { name: string; email: string; password: string; orgName?: string }, meta: { userAgent?: string; ip?: string }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict("An account with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email, name: input.name, passwordHash },
  });

  const org = await provisionOrg(input.orgName?.trim() || `${input.name.split(" ")[0]}'s workspace`, user.id);
  const { createSession } = await import("../auth/session");
  const session = await createSession(user.id, org.id, meta);
  return { user, org, session };
}

export async function provisionOrg(name: string, ownerId: string) {
  await ensureCommunities();
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.organization.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      members: { create: { userId: ownerId, role: "OWNER" } },
      sources: {
        create: [
          { adapter: "hackernews", name: "Hacker News", status: "ACTIVE" },
          { adapter: "reddit", name: "Reddit", status: "ACTIVE" },
          { adapter: "sandbox", name: "Sandbox (demo source)", status: "PAUSED" },
        ],
      },
      integrations: { create: [] },
    },
  });
  await ensureSubscription(org.id);
  return org;
}

export async function login(email: string, password: string, meta: { userAgent?: string; ip?: string }) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw unauthorized("Invalid email or password");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const { createSession } = await import("../auth/session");
  const session = await createSession(user.id, membership?.orgId ?? null, meta);
  return { user, orgId: membership?.orgId ?? null, session };
}

export async function listOrgsFor(userId: string) {
  return prisma.membership.findMany({ where: { userId }, include: { org: true }, orderBy: { createdAt: "asc" } });
}

export async function switchOrg(userId: string, orgId: string, sessionId: string) {
  const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  if (!membership) throw conflict("No access to that workspace");
  await prisma.session.update({ where: { id: sessionId }, data: { orgId } });
}

export async function createOrg(userId: string, name: string) {
  const org = await provisionOrg(name, userId);
  await prisma.membership.create({ data: { userId, orgId: org.id, role: "OWNER" } });
  await enqueueJob("DISCOVERY_SCAN", org.id, { orgId: org.id, live: false }, { runAt: new Date(Date.now() + 60_000) });
  return org;
}
