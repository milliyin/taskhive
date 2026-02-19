// Location: src/app/api/v1/webhooks/route.ts — POST register + GET list webhooks
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, getIdempotentResponse, storeIdempotentResponse } from "@/lib/agent-auth";
import { WEBHOOK_EVENTS } from "@/lib/webhook-dispatcher";
import db from "@/db/index";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders, idempotencyKey } = auth;

  // Idempotency check
  if (idempotencyKey) {
    const cached = getIdempotentResponse(agent.id, idempotencyKey);
    if (cached) return withRateHeaders(cached, rateHeaders);
  }

  const body = await request.json();
  const { url, events } = body;

  // Validate URL
  if (!url || typeof url !== "string") {
    return apiError(422, "VALIDATION_ERROR",
      "url is required",
      "Include a valid HTTPS URL in request body"
    );
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return apiError(422, "VALIDATION_ERROR",
        "Webhook URL must use HTTPS",
        "Provide a URL starting with https://"
      );
    }
  } catch {
    return apiError(422, "VALIDATION_ERROR",
      "Invalid URL format",
      "Provide a valid URL (e.g., https://example.com/webhooks)"
    );
  }

  // Validate events
  if (!events || !Array.isArray(events) || events.length === 0) {
    return apiError(422, "VALIDATION_ERROR",
      "events is required (non-empty array)",
      `Valid events: ${WEBHOOK_EVENTS.join(", ")}`
    );
  }

  const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as typeof WEBHOOK_EVENTS[number]));
  if (invalidEvents.length > 0) {
    return apiError(422, "VALIDATION_ERROR",
      `Invalid event(s): ${invalidEvents.join(", ")}`,
      `Valid events: ${WEBHOOK_EVENTS.join(", ")}`
    );
  }

  // Check max webhooks (limit to 5 per agent)
  const existing = await db.select().from(webhooks).where(eq(webhooks.agentId, agent.id));
  if (existing.length >= 5) {
    return apiError(409, "LIMIT_REACHED",
      "Maximum 5 webhooks per agent",
      "Delete an existing webhook with DELETE /api/v1/webhooks/:id"
    );
  }

  // Generate signing secret
  const secret = `whsec_${randomBytes(24).toString("hex")}`;

  // Create webhook
  const result = await db
    .insert(webhooks)
    .values({
      agentId: agent.id,
      url,
      secret,
      events,
      isActive: true,
      failureCount: 0,
    })
    .returning();

  const hook = result[0];
  const data = {
    id: hook.id,
    url: hook.url,
    secret, // Only shown once at creation
    events: hook.events,
    is_active: hook.isActive,
    created_at: hook.lastTriggeredAt || new Date().toISOString(),
  };

  const response = withRateHeaders(apiSuccess(data, {
    note: "Save the secret — it won't be shown again. Use it to verify webhook signatures.",
  }, 201), rateHeaders);

  // Store idempotent response
  if (idempotencyKey) {
    const responseBody = JSON.stringify({ ok: true, data, meta: { timestamp: new Date().toISOString() } });
    storeIdempotentResponse(agent.id, idempotencyKey, response, responseBody);
  }

  return response;
}

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const hooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.agentId, agent.id))
    .orderBy(webhooks.id);

  const data = hooks.map((h) => ({
    id: h.id,
    url: h.url,
    events: h.events,
    is_active: h.isActive,
    failure_count: h.failureCount,
    last_triggered_at: h.lastTriggeredAt,
  }));

  return withRateHeaders(apiSuccess(data, { count: data.length }), rateHeaders);
}