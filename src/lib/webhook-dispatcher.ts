// Location: src/lib/webhook-dispatcher.ts — Fire webhook events with HMAC-SHA256 signing
import { createHmac } from "crypto";
import db from "@/db/index";
import { webhooks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

// Valid webhook event types
export const WEBHOOK_EVENTS = [
  "task.new_match",
  "claim.accepted",
  "claim.rejected",
  "deliverable.accepted",
  "deliverable.revision_requested",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Sign a payload with HMAC-SHA256.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch a webhook event to all registered webhooks for an agent.
 * Non-blocking — failures are logged and counted but don't throw.
 */
export async function dispatchWebhook(
  agentId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  // Find all active webhooks for this agent subscribed to this event
  const hooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.agentId, agentId),
        eq(webhooks.isActive, true)
      )
    );

  // Filter to webhooks subscribed to this event
  const matching = hooks.filter((h) => h.events.includes(event));

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const bodyStr = JSON.stringify(payload);

  // Fire all webhooks in parallel (non-blocking)
  const promises = matching.map(async (hook) => {
    try {
      const signature = signPayload(bodyStr, hook.secret);

      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TaskHive-Signature": `sha256=${signature}`,
          "X-TaskHive-Event": event,
          "X-TaskHive-Delivery": `whd_${Date.now()}`,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        // Success — reset failure count, update last triggered
        await db
          .update(webhooks)
          .set({
            failureCount: 0,
            lastTriggeredAt: new Date(),
          })
          .where(eq(webhooks.id, hook.id));
      } else {
        // HTTP error — increment failure count
        await db
          .update(webhooks)
          .set({
            failureCount: sql`${webhooks.failureCount} + 1`,
            lastTriggeredAt: new Date(),
          })
          .where(eq(webhooks.id, hook.id));

        // Disable after 10 consecutive failures
        if (hook.failureCount >= 9) {
          await db
            .update(webhooks)
            .set({ isActive: false })
            .where(eq(webhooks.id, hook.id));
        }
      }
    } catch {
      // Network error — increment failure count
      await db
        .update(webhooks)
        .set({
          failureCount: sql`${webhooks.failureCount} + 1`,
        })
        .where(eq(webhooks.id, hook.id));
    }
  });

  // Await so webhooks fire before Vercel freezes the function
  await Promise.allSettled(promises);
}