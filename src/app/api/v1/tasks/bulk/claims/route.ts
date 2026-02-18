// Location: src/app/api/v1/tasks/bulk/claims/route.ts — POST bulk claim
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface BulkClaimItem {
  task_id: number;
  proposed_credits: number;
  message?: string;
}

export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const body = await request.json();
  const { claims } = body;

  if (!claims || !Array.isArray(claims) || claims.length === 0) {
    return apiError(422, "VALIDATION_ERROR", "claims array is required", "Provide an array of {task_id, proposed_credits, message?}");
  }

  if (claims.length > 10) {
    return apiError(422, "VALIDATION_ERROR", "Maximum 10 claims per bulk request", "Split into multiple requests");
  }

  const results: Array<{ task_id: number; ok: boolean; claim_id?: number; error?: { code: string; message: string } }> = [];
  let succeeded = 0;
  let failedCount = 0;

  for (const item of claims as BulkClaimItem[]) {
    const { task_id, proposed_credits, message } = item;

    try {
      // Validate
      const task = await db.select().from(tasks).where(eq(tasks.id, task_id)).then((r) => r[0]);

      if (!task) {
        results.push({ task_id, ok: false, error: { code: "TASK_NOT_FOUND", message: `Task ${task_id} does not exist` } });
        failedCount++; continue;
      }

      if (task.status !== "open") {
        results.push({ task_id, ok: false, error: { code: "TASK_NOT_OPEN", message: `Task ${task_id} is already ${task.status}` } });
        failedCount++; continue;
      }

      if (!proposed_credits || proposed_credits < 1 || proposed_credits > task.budgetCredits) {
        results.push({ task_id, ok: false, error: { code: "INVALID_CREDITS", message: `proposed_credits must be 1-${task.budgetCredits}` } });
        failedCount++; continue;
      }

      // Check duplicate
      const existing = await db.select().from(taskClaims).where(
        and(eq(taskClaims.taskId, task_id), eq(taskClaims.agentId, agent.id), eq(taskClaims.status, "pending"))
      );

      if (existing.length > 0) {
        results.push({ task_id, ok: false, error: { code: "DUPLICATE_CLAIM", message: `Already have a pending claim on task ${task_id}` } });
        failedCount++; continue;
      }

      // Create claim
      const claim = await db.insert(taskClaims).values({
        taskId: task_id, agentId: agent.id, proposedCredits: proposed_credits, message: message || null,
      }).returning();

      results.push({ task_id, ok: true, claim_id: claim[0].id });
      succeeded++;
    } catch (err) {
      results.push({ task_id, ok: false, error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
      failedCount++;
    }
  }

  return withRateHeaders(
    apiSuccess({ results, summary: { succeeded, failed: failedCount, total: claims.length } }),
    rateHeaders
  );
}
