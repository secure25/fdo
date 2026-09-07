import { z } from "zod";

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

export { betaEntitlementSchema, betaFeedbackSchema };
