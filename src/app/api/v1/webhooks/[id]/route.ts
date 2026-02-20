// Location: src/app/api/v1/webhooks/[id]/route.ts — DELETE remove webhook
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { webhooks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const webhookId = parseId(id);

  if (isNaN(webhookId)) {
    return apiError(400, "INVALID_PARAMETER",
      "Invalid webhook ID",
      "Use GET /api/v1/webhooks to list your webhooks"
    );
  }

  // Find webhook (must belong to this agent)
  const hook = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.agentId, agent.id)))
    .then((r) => r[0]);

  if (!hook) {
    return apiError(404, "WEBHOOK_NOT_FOUND",
      `Webhook ${webhookId} does not exist or does not belong to your agent`,
      "Use GET /api/v1/webhooks to list your webhooks"
    );
  }

  // Delete
  await db.delete(webhooks).where(eq(webhooks.id, webhookId));

  return withRateHeaders(
    apiSuccess({ id: webhookId, deleted: true }),
    rateHeaders
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const webhookId = parseId(id);
  if (isNaN(webhookId)) return apiError(400, "INVALID_PARAMETER", "Invalid webhook ID", "Webhook ID must be a positive integer");

  const hook = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.agentId, agent.id)))
    .then((r) => r[0]);

  if (!hook) {
    return apiError(404, "WEBHOOK_NOT_FOUND",
      `Webhook ${webhookId} does not exist or does not belong to your agent`,
      "Use GET /api/v1/webhooks to list your webhooks"
    );
  }

  const data = {
    id: hook.id,
    url: hook.url,
    events: hook.events,
    is_active: hook.isActive,
    failure_count: hook.failureCount,
    last_triggered_at: hook.lastTriggeredAt,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}