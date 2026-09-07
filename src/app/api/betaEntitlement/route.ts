import { withRoute, json } from "@/lib/api";
import { requireApi } from "@/lib/auth/guard";
import { betaEntitlementSchema } from "@/lib/validation/schemas";
import { activateBetaEntitlement, getActiveBetaEntitlement, isBetaEntitlementActive, addAuditLog } from "@/lib/betaEntitlement/betaEntitlement.service";

export const POST = withRoute(
  async ({ req }) => {
    await requireApi();
    const auth = await requireApi();
    const data = betaEntitlementSchema.parse(await req.json());
    
    // Only allow beta activation for organizations without an active paid subscription
    const subscription = await prisma.subscription.findFirst({
      where: { orgId: auth.orgId, status: "ACTIVE" },
    });
    
    if (subscription) {
      return json({ 
        error: { 
          code: "CONFLICT", 
          message: "Cannot activate beta entitlement while an active paid subscription exists" 
        } 
      }, { status: 409 });
    }
    
    // Check if there's already an active beta entitlement
    const existing = await getActiveBetaEntitlement(auth.orgId);
    if (existing) {
      return json({ 
        error: { 
          code: "CONFLICT", 
          message: "An active beta entitlement already exists for this organization" 
        } 
      }, { status: 409 });
    }
    
    // Activate the beta entitlement
    const betaEntitlement = await activateBetaEntitlement(
      auth.orgId,
      auth.userId,
      data.cohort || "BETA_DEFAULT"
    );
    
    // Add audit log entry
    await addAuditLog(
      auth.orgId,
      "BETA_ACTIVATED_VIA_API",
      auth.userId,
      { cohort: data.cohort }
    );
    
    return json({ 
      ok: true, 
      betaEntitlement: {
        id: betaEntitlement.id,
        startsAt: betaEntitlement.startsAt,
        endsAt: betaEntitlement.endsAt,
        status: betaEntitlement.status,
        cohort: betaEntitlement.cohort
      }
    });
  },
  { name: "betaEntitlement/activate" }
);

export const GET = withRoute(
  async ({ req }) => {
    await requireApi();
    const auth = await requireApi();
    
    const active = await isBetaEntitlementActive(auth.orgId);
    const betaEntitlement = await getActiveBetaEntitlement(auth.orgId);
    
    return json({
      active: active,
      betaEntitlement: betaEntitlement ? {
        id: betaEntitlement.id,
        startsAt: betaEntitlement.startsAt,
        endsAt: betaEntitlement.endsAt,
        status: betaEntitlement.status,
        cohort: betaEntitlement.cohort,
        daysRemaining: Math.max(0, Math.ceil((betaEntitlement.endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      } : null
    });
  },
  { name: "betaEntitlement/status" }
);
