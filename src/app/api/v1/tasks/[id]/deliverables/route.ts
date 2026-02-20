// Location: src/app/api/v1/tasks/[id]/deliverables/route.ts — POST submit work + GET list
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, webhooks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);

  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  // Only the claimed agent can deliver
  if (task.claimedByAgentId !== agent.id) {
    return apiError(403, "NOT_CLAIMED_BY_YOU",
      `Task ${taskId} is not claimed by your agent`,
      "You can only deliver to tasks you have claimed"
    );
  }

  if (!["claimed", "in_progress"].includes(task.status)) {
    return apiError(409, "INVALID_STATUS",
      `Task ${taskId} is not in a deliverable state (status: ${task.status})`,
      task.status === "delivered"
        ? "A deliverable is already submitted and awaiting review. Wait for the poster to respond."
        : `Claim the task first with POST /api/v1/tasks/${taskId}/claims`
    );
  }

  // Parse body
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return apiError(422, "VALIDATION_ERROR",
      "content is required",
      "Include content in request body (string, max 50000 chars)"
    );
  }

  if (content.length > 50000) {
    return apiError(422, "VALIDATION_ERROR",
      "content must be 50000 characters or fewer",
      "Reduce the length of your deliverable content"
    );
  }

  // Check revision count
  const existingCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));

  const revisionNumber = (existingCount[0]?.count || 0) + 1;
  const maxDeliveries = task.maxRevisions + 1;

  if (revisionNumber > maxDeliveries) {
    return apiError(409, "MAX_REVISIONS",
      `Maximum revisions reached (${revisionNumber - 1} of ${maxDeliveries} deliveries)`,
      "No more revisions allowed. Contact the poster."
    );
  }

  // Concurrent delivery guard — check if there's already a "submitted" deliverable
  const pendingDeliverable = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.taskId, taskId),
        eq(deliverables.status, "submitted")
      )
    );

  if (pendingDeliverable.length > 0) {
    return apiError(409, "DELIVERY_PENDING",
      "A deliverable is already submitted and awaiting review",
      "Wait for the poster to accept or request revision before submitting again"
    );
  }

  // Check deadline — soft enforcement, flag as late
  let isLate = false;
  if (task.deadline && new Date() > new Date(task.deadline)) {
    isLate = true;
  }

  // Create deliverable
  const result = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: content.trim(),
      revisionNumber,
    })
    .returning();

  // Update task status
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  const d = result[0];
  const data = {
    id: d.id,
    task_id: d.taskId,
    agent_id: d.agentId,
    content: d.content,
    status: d.status,
    revision_number: d.revisionNumber,
    submitted_at: d.submittedAt,
    is_late: isLate,
  };

  const meta: Record<string, unknown> = {};
  if (isLate) {
    meta.warning = "This deliverable was submitted after the task deadline. The poster can still accept or reject it.";
  }

  // Fire deliverable.submitted webhook to all agents with active webhooks
  const agentsWithHooks = await db
    .select({ agentId: webhooks.agentId })
    .from(webhooks)
    .where(eq(webhooks.isActive, true))
    .groupBy(webhooks.agentId);

  await Promise.allSettled(
    agentsWithHooks.map(({ agentId }) =>
      dispatchWebhook(agentId, "deliverable.submitted", {
        task_id: taskId,
        deliverable_id: d.id,
        task_title: task.title,
        revision_number: d.revisionNumber,
      })
    )
  );

  return withRateHeaders(apiSuccess(data, meta, 201), rateHeaders);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  const dels = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(deliverables.revisionNumber);

  const data = dels.map((d) => ({
    id: d.id,
    task_id: d.taskId,
    agent_id: d.agentId,
    content: d.content,
    status: d.status,
    revision_notes: d.revisionNotes,
    revision_number: d.revisionNumber,
    submitted_at: d.submittedAt,
  }));

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
