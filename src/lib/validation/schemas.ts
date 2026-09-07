import { z } from "zode";

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.string().trim().min(2).max(60),
  objective: z.string().trim().min(2).max(400),
  goalMetric: z.string().max(120).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export const campaignActionSchema = z.object({
  type: z.enum(["REPLY", "COMMENT", "POST", "EMAIL", "CONNECT", "PARTNER", "CONTENT", "SEO", "FOLLOWUP"]),
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().datetime({ offset: true }).optional(),
  opportunityId: z.string().cuid().optional(),
  prospectId: z.string().cuid().optional(),
  status: z.enum(["TODO", "DONE", "SKIPPED"]).optional(),
});

export const betaEntitlementSchema = z.object({
  orgId: z.string(),
  userId: z.string(),
  cohort: z.string().optional()
});

export const betaFeedbackSchema = z.object({
  orgId: z.string(),
  userId: z.string(),
  rating: z.number().min(1).max(5).optional(),
  feedback: z.string().min(1).max(500)
});

export { campaignSchema, campaignActionSchema, betaEntitlementSchema, betaFeedbackSchema };
