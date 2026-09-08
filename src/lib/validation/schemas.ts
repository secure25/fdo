import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  orgName: z.string().trim().min(2).max(80).optional().or(z.literal("")),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url().max(300).optional().or(z.literal("")),
  description: z.string().trim().min(20).max(2000),
  targetCustomer: z.string().trim().max(160).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  geography: z.string().trim().max(80).optional().or(z.literal("")),
  budgetBand: z.enum(["NONE", "LEAN", "MODERATE", "FUNDED"]).optional(),
  timePerWeek: z.coerce.number().int().min(0).max(80).optional(),
});

export const opportunityActionSchema = z.object({
  status: z.enum(["NEW", "SAVED", "DISMISSED", "ACTED", "CONVERTED"]),
});

export const draftRequestSchema = z.object({
  channel: z.enum(["REDDIT", "LINKEDIN", "X", "YOUTUBE", "SEO", "EMAIL", "BLOG"]),
  format: z.enum(["REPLY", "COMMENT", "POST", "THREAD", "SCRIPT", "ARTICLE", "COMPARISON", "LANDING", "OUTREACH", "FOLLOWUP"]),
  opportunityId: z.string().optional(),
  productId: z.string().optional(),
  pitchAllowed: z.boolean().optional(),
  topicHint: z.string().optional(),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.string().trim().min(2).max(60),
  objective: z.string().trim().min(2).max(400),
  goalMetric: z.string().max(120).optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export const campaignActionSchema = z.object({
  type: z.enum(["REPLY", "COMMENT", "POST", "EMAIL", "CONNECT", "PARTNER", "CONTENT", "SEO", "FOLLOWUP"]),
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().optional().nullable(),
  opportunityId: z.string().cuid().optional(),
  prospectId: z.string().cuid().optional(),
  status: z.enum(["TODO", "DONE", "SKIPPED"]).optional(),
});

export const betaEntitlementSchema = z.object({
  orgId: z.string().optional(),
  userId: z.string().optional(),
  cohort: z.string().optional(),
});

export const betaFeedbackSchema = z.object({
  orgId: z.string().optional(),
  userId: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  feedback: z.string().min(1).max(500),
});

export const billingSchema = z.object({
  plan: z.enum(["FREE", "MAKER", "GROWTH", "PRO"]).optional(),
  credits: z.coerce.number().int().positive().optional(),
});

export const competitorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(300).optional().or(z.literal("")),
  positioning: z.string().trim().max(500).optional().or(z.literal("")),
});

export const competitorEventSchema = z.object({
  competitorId: z.string().cuid(),
  kind: z.enum(["PRICING", "FEATURE", "LAUNCH", "REVIEW", "CONTENT", "POSITIONING", "COMPLAINT"]),
  detail: z.string().trim().min(1).max(2000),
});

export const contentUpdateSchema = z.object({
  action: z.enum(["approve", "publish", "archive", "edit"]),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().max(10000).optional(),
  url: z.string().trim().url().max(500).optional().or(z.literal("")),
  metrics: z.record(z.string(), z.number()).optional(),
});

export const scanSchema = z.object({
  live: z.boolean().optional().default(false),
  productId: z.string().optional().nullable(),
});

export const experimentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  hypothesis: z.string().trim().min(5).max(1000),
  channelA: z.string().trim().min(1).max(60),
  channelB: z.string().trim().min(1).max(60),
});

export const experimentResultSchema = z.object({
  channel: z.string().trim().min(1).max(60),
  opportunities: z.coerce.number().int().min(0).default(0),
  engagements: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  signups: z.coerce.number().int().min(0).default(0),
  activations: z.coerce.number().int().min(0).default(0),
  customers: z.coerce.number().int().min(0).default(0),
  revenueCents: z.coerce.number().int().min(0).default(0),
  spendCents: z.coerce.number().int().min(0).default(0),
  hoursInvested: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const integrationSchema = z.object({
  action: z.enum(["connect", "disconnect"]),
  provider: z.string().trim().min(1).max(60),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const settingsSchema = z.object({
  orgName: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  defaultProductId: z.string().cuid().optional(),
});

export const prospectUpdateSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "ENGAGED", "QUALIFIED", "CUSTOMER", "LOST"]).optional(),
  notes: z.string().trim().max(2000).optional(),
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
});

export const recommendationSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["OPEN", "ACCEPTED", "DONE", "DISMISSED"]),
});

export const strategistSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

