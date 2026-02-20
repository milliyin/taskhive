// Location: src/lib/schemas.ts — Centralized Zod schemas for request validation
import { z } from "zod";
import { PLATFORM } from "@/lib/constants";

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

/** Parse request body against a Zod schema. Returns discriminated union for TS narrowing. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.issues[0].message };
}

// ═══════════════════════════════════════════════════════════════════════
// V1 Agent API schemas
// ═══════════════════════════════════════════════════════════════════════

export const updateAgentProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  capabilities: z.array(z.string()).optional(),
  category_ids: z.array(z.number().int()).optional(),
  hourly_rate_credits: z.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "No valid fields to update. Provide name, description, capabilities, category_ids, or hourly_rate_credits" }
);

export const createWebhookSchema = z.object({
  url: z.string().url("Invalid URL format").refine(
    (u) => u.startsWith("https://"),
    { message: "Webhook URL must use HTTPS" }
  ),
  events: z.array(z.string()).min(1, "events must be a non-empty array"),
});

export const claimTaskSchema = z.object({
  proposed_credits: z.number({ error: "proposed_credits is required" }).int().min(1, "proposed_credits must be at least 1"),
  message: z.string().max(1000, "message must be 1000 characters or fewer").optional(),
});

export const bulkClaimItemSchema = z.object({
  task_id: z.number().int().positive(),
  proposed_credits: z.number().int().min(1),
  message: z.string().max(1000).optional(),
});

export const bulkClaimsSchema = z.object({
  claims: z.array(bulkClaimItemSchema).min(1, "claims array is required").max(10, "Maximum 10 claims per bulk request"),
});

export const submitDeliverableSchema = z.object({
  content: z.string({ error: "content is required" })
    .min(1, "content cannot be empty")
    .max(50000, "content must be 50000 characters or fewer")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "content cannot be empty" }),
});

export const requestRevisionSchema = z.object({
  revision_notes: z.string({ error: "revision_notes is required" })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "revision_notes is required" }),
});

export const submitReviewSchema = z.object({
  verdict: z.enum(["pass", "fail", "skipped"], { error: "verdict must be 'pass', 'fail', or 'skipped'" }),
  feedback: z.string().nullish(),
  scores: z.unknown().nullish(),
  key_source: z.string().nullish(),
  llm_model_used: z.string().nullish(),
  reviewed_at: z.string().nullish(),
});

// ═══════════════════════════════════════════════════════════════════════
// Dashboard API schemas
// ═══════════════════════════════════════════════════════════════════════

export const createAgentSchema = z.object({
  name: z.string().min(2, "Agent name is required (min 2 chars)"),
  description: z.string().min(5, "Description is required (min 5 chars)"),
  capabilities: z.array(z.string()).default([]),
});

export const llmSettingsSchema = z.object({
  freelancerLlmProvider: z.enum(["openrouter", "anthropic", "openai"], { error: "Invalid provider. Use: openrouter, anthropic, or openai" }),
  freelancerLlmKey: z.string().min(1, "Key is required"),
});

export const createTaskSchema = z.object({
  title: z.string().min(5, "Title must be 5–200 characters").max(200, "Title must be 5–200 characters"),
  description: z.string().min(20, "Description must be 20–5000 characters").max(5000, "Description must be 20–5000 characters"),
  budgetCredits: z.number().int().min(PLATFORM.MIN_TASK_BUDGET, `Budget must be at least ${PLATFORM.MIN_TASK_BUDGET} credits`),
  categoryId: z.union([z.string(), z.number()]).optional().nullable(),
  deadline: z.string().optional().nullable(),
  maxRevisions: z.number().int().min(0).max(5, "Max revisions must be 0–5").optional(),
  autoReviewEnabled: z.boolean().optional(),
  posterLlmKey: z.string().optional().nullable(),
  posterLlmProvider: z.string().optional().nullable(),
  posterMaxReviews: z.union([z.string(), z.number()]).optional().nullable(),
});

export const claimActionSchema = z.object({
  action: z.enum(["accept", "reject"], { error: "action must be 'accept' or 'reject'" }),
});

export const deliverableActionSchema = z.object({
  action: z.enum(["accept", "revision", "reject"], { error: "action must be 'accept', 'revision', or 'reject'" }),
  revisionNotes: z.string().optional(),
});

export const createReviewSchema = z.object({
  agentId: z.number().int().positive("agentId is required"),
  rating: z.number().int().min(1, "Rating must be 1–5").max(5, "Rating must be 1–5"),
  qualityScore: z.number().min(1).max(5).optional().nullable(),
  speedScore: z.number().min(1).max(5).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
});
