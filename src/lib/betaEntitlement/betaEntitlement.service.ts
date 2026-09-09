import { prisma } from "../db";
import { Prisma } from "@prisma/client";

const logger = {
  info: (...args: unknown[]) => console.info(...args)
};

function jparse<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  return JSON.parse(value) as T;
}

export type BetaEntitlementStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export type BetaEntitlementWithRelations = {
  id: string;
  orgId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  status: BetaEntitlementStatus;
  cohort: string;
  auditLog: Array<{
    timestamp: string;
    action: string;
    userId: string;
    details: Record<string, unknown>;
  }>;
};

export type BetaFeedbackWithRelations = {
  id: string;
  orgId: string;
  userId: string;
  rating: number | null;
  feedback: string;
  createdAt: Date;
};

/**
 * Activates a beta entitlement for an organization.
 * @param orgId The organization ID
 * @param userId The user ID activating the beta (typically the current user)
 * @param cohort The cohort identifier (e.g., 'BETA_2026_09')
 * @returns The created beta entitlement
 */
export async function activateBetaEntitlement(
  orgId: string,
  userId: string,
  cohort: string = "BETA_DEFAULT"
): Promise<BetaEntitlementWithRelations> {
  // Check if there's already an active beta entitlement for this org
  const existing = await getActiveBetaEntitlement(orgId);
  if (existing) {
    throw new Error("An active beta entitlement already exists for this organization");
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const betaEntitlement = await prisma.betaEntitlement.create({
    data: {
      orgId,
      userId,
      startsAt,
      endsAt,
      status: "ACTIVE",
      cohort,
      auditLog: [{
        timestamp: new Date().toISOString(),
        action: "ACTIVATED",
        userId,
        details: { cohort }
      }]
    }
  });

  // Grant Pro plan AI credits (10,000 credits) to the organization's subscription
  await prisma.subscription.updateMany({
    where: { orgId },
    data: {
      creditsBalance: 10000,
    },
  });

  logger.info("beta entitlement activated", { orgId, userId, cohort });
  return {
    id: betaEntitlement.id,
    orgId: betaEntitlement.orgId,
    userId: betaEntitlement.userId,
    startsAt: betaEntitlement.startsAt,
    endsAt: betaEntitlement.endsAt,
    status: betaEntitlement.status as BetaEntitlementStatus,
    cohort: betaEntitlement.cohort,
    auditLog: jparse<Array<{
      timestamp: string;
      action: string;
      userId: string;
      details: Record<string, unknown>;
    }>>(betaEntitlement.auditLog ?? "[]")
  };
}

/**
 * Gets the active beta entitlement for an organization, if any.
 * @param orgId The organization ID
 * @returns The active beta entitlement or null if none exists or is expired
 */
export async function getActiveBetaEntitlement(orgId: string): Promise<BetaEntitlementWithRelations | null> {
  const betaEntitlement = await prisma.betaEntitlement.findFirst({
    where: {
      orgId,
      status: "ACTIVE",
      endsAt: {
        gt: new Date()
      }
    }
  });

  if (!betaEntitlement) return null;

  return {
    id: betaEntitlement.id,
    orgId: betaEntitlement.orgId,
    userId: betaEntitlement.userId,
    startsAt: betaEntitlement.startsAt,
    endsAt: betaEntitlement.endsAt,
    status: betaEntitlement.status as BetaEntitlementStatus,
    cohort: betaEntitlement.cohort,
    auditLog: jparse<Array<{
      timestamp: string;
      action: string;
      userId: string;
      details: Record<string, unknown>;
    }>>(betaEntitlement.auditLog ?? "[]")
  };
}

/**
 * Checks if there is an active beta entitlement for the organization.
 * @param orgId The organization ID
 * @returns True if there is an active beta entitlement
 */
export async function isBetaEntitlementActive(orgId: string): Promise<boolean> {
  const betaEntitlement = await getActiveBetaEntitlement(orgId);
  return !!betaEntitlement;
}

/**
 * Gets the beta entitlement status for an organization.
 * Returns null if no beta entitlement exists.
 * @param orgId The organization ID
 * @returns The status (ACTIVE, EXPIRED, REVOKED) or null
 */
export async function getBetaEntitlementStatus(orgId: string): Promise<BetaEntitlementStatus | null> {
  const betaEntitlement = await prisma.betaEntitlement.findFirst({
    where: {
      orgId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!betaEntitlement) return null;
  return betaEntitlement.status as BetaEntitlementStatus;
}

/**
 * Expires the beta entitlement for an organization.
 * Sets the status to EXPIRED.
 * @param orgId The organization ID
 * @returns The updated beta entitlement
 */
export async function expireBetaEntitlement(orgId: string): Promise<BetaEntitlementWithRelations> {
  const betaEntitlement = await prisma.betaEntitlement.updateMany({
    where: {
      orgId,
      status: "ACTIVE"
    },
    data: {
      status: "EXPIRED",
      auditLog: {
        push: {
          timestamp: new Date().toISOString(),
          action: "EXPIRED",
          userId: "SYSTEM", // This would be set by the system job
          details: {}
        }
      }
    }
  });

  // We need to fetch the updated record to return it
  const updated = await prisma.betaEntitlement.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" }
  });

  if (!updated) {
    throw new Error("Failed to expire beta entitlement");
  }

  return {
    id: updated.id,
    orgId: updated.orgId,
    userId: updated.userId,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    status: updated.status as BetaEntitlementStatus,
    cohort: updated.cohort,
    auditLog: jparse<Array<{
      timestamp: string;
      action: string;
      userId: string;
      details: Record<string, unknown>;
    }>>(updated.auditLog ?? "[]")
  };
}

/**
 * Revokes the beta entitlement for an organization.
 * @param orgId The organization ID
 * @param reason The reason for revocation
 * @param userId The user ID performing the revocation (e.g., admin)
 * @returns The updated beta entitlement
 */
export async function revokeBetaEntitlement(
  orgId: string,
  reason: string,
  userId: string
): Promise<BetaEntitlementWithRelations> {
  const betaEntitlement = await prisma.betaEntitlement.updateMany({
    where: {
      orgId,
      status: { in: ["ACTIVE", "EXPIRED"] }
    },
    data: {
      status: "REVOKED",
      auditLog: {
        push: {
          timestamp: new Date().toISOString(),
          action: "REVOKED",
          userId,
          details: { reason }
        }
      }
    }
  });

  const updated = await prisma.betaEntitlement.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" }
  });

  if (!updated) {
    throw new Error("Failed to revoke beta entitlement");
  }

  return {
    id: updated.id,
    orgId: updated.orgId,
    userId: updated.userId,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    status: updated.status as BetaEntitlementStatus,
    cohort: updated.cohort,
    auditLog: jparse<Array<{
      timestamp: string;
      action: string;
      userId: string;
      details: Record<string, unknown>;
    }>>(updated.auditLog ?? "[]")
  };
}

/**
 * Adds an audit log entry to the beta entitlement.
 * @param orgId The organization ID
 * @param action The action being audited
 * @param userId The user ID performing the action
 * @param details Additional details about the action
 */
export async function addAuditLog(
  orgId: string,
  action: string,
  userId: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await prisma.betaEntitlement.updateMany({
    where: {
      orgId
    },
    data: {
      auditLog: {
        push: {
          timestamp: new Date().toISOString(),
          action,
          userId,
          details: details as Prisma.InputJsonValue
        }
      }
    }
  });
}

/**
 * Creates a beta feedback entry.
 * @param orgId The organization ID
 * @param userId The user ID providing feedback
 * @param rating The rating (1-5, optional)
 * @param feedback The feedback text
 * @returns The created beta feedback
 */
export async function createBetaFeedback(
  orgId: string,
  userId: string,
  rating: number | null,
  feedback: string
): Promise<BetaFeedbackWithRelations> {
  const feedbackEntry = await prisma.betaFeedback.create({
    data: {
      orgId,
      userId,
      rating,
      feedback
    }
  });

  return {
    id: feedbackEntry.id,
    orgId: feedbackEntry.orgId,
    userId: feedbackEntry.userId,
    rating: feedbackEntry.rating,
    feedback: feedbackEntry.feedback,
    createdAt: feedbackEntry.createdAt
  };
}

