// Location: src/app/api/v1/tasks/[id]/claims/route.ts — POST claim task + GET list claims
import {
  authenticateAgent,
  apiSuccess,
  apiError,
  withRateHeaders,
  getIdempotentResponse,
  storeIdempotentResponse,
  parseId,
} from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims, agents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders, idempotencyKey } = auth;

  // [IDEMPOTENCY] Check cache — return stored response if duplicate request
  if (idempotencyKey) {
    const cached = getIdempotentResponse(agent.id, idempotencyKey);
    if (cached) return withRateHeaders(cached, rateHeaders);
  }

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

  // Self-claim guard — agent cannot claim tasks posted by its own operator
  if (task.posterId === agent.operatorId) {
    return apiError(409, "SELF_CLAIM",
      `You cannot claim your own task (task ${taskId})`,
      "Agents cannot claim tasks posted by their own operator. Browse other tasks with GET /api/v1/tasks?status=open"
    );
  }

  // Task must be open — specific messages for each non-open status
  if (task.status !== "open") {
    const suggestions: Record<string, string> = {
      claimed: "This task has already been claimed. Browse open tasks with GET /api/v1/tasks?status=open",
      in_progress: "This task is already in progress. Browse open tasks with GET /api/v1/tasks?status=open",
      delivered: "This task already has a deliverable submitted. Browse open tasks with GET /api/v1/tasks?status=open",
      completed: "This task is already completed. Browse open tasks with GET /api/v1/tasks?status=open",
      cancelled: "This task was cancelled and is no longer accepting claims. Browse open tasks with GET /api/v1/tasks?status=open",
      disputed: "This task is in dispute. Browse open tasks with GET /api/v1/tasks?status=open",
    };

    return apiError(409, "TASK_NOT_OPEN",
      `Task ${taskId} is not open (current status: ${task.status})`,
      suggestions[task.status] || "Browse open tasks with GET /api/v1/tasks?status=open"
    );
  }

  // Parse body
  const body = await request.json();
  const { proposed_credits, message } = body;

  if (!proposed_credits || typeof proposed_credits !== "number" || proposed_credits < 1) {
    return apiError(422, "VALIDATION_ERROR",
      "proposed_credits is required",
      "Include proposed_credits in request body (integer, min 1)"
    );
  }

  if (proposed_credits > task.budgetCredits) {
    return apiError(422, "INVALID_CREDITS",
      `proposed_credits (${proposed_credits}) exceeds task budget (${task.budgetCredits})`,
      `Propose credits ≤ ${task.budgetCredits}`
    );
  }

  if (message && message.length > 1000) {
    return apiError(422, "VALIDATION_ERROR",
      "message must be 1000 characters or fewer",
      "Shorten your message"
    );
  }

  // Check for duplicate claim
  const existing = await db
    .select()
    .from(taskClaims)
    .where(and(
      eq(taskClaims.taskId, taskId),
      eq(taskClaims.agentId, agent.id),
      eq(taskClaims.status, "pending")
    ));

  if (existing.length > 0) {
    return apiError(409, "DUPLICATE_CLAIM",
      `You already have a pending claim on task ${taskId}`,
      "Check your claims with GET /api/v1/agents/me/claims"
    );
  }

  // Create claim
  const claim = await db
    .insert(taskClaims)
    .values({
      taskId,
      agentId: agent.id,
      proposedCredits: proposed_credits,
      message: message || null,
    })
    .returning();

  const c = claim[0];
  const data = {
    id: c.id,
    task_id: c.taskId,
    agent_id: c.agentId,
    proposed_credits: c.proposedCredits,
    message: c.message,
    status: c.status,
    created_at: c.createdAt,
  };

  const response = withRateHeaders(apiSuccess(data, {}, 201), rateHeaders);

  // [IDEMPOTENCY] Store response for future duplicate requests
  if (idempotencyKey) {
    const responseBody = JSON.stringify({
      ok: true,
      data,
      meta: { timestamp: new Date().toISOString(), request_id: `req_${Date.now()}` },
    });
    storeIdempotentResponse(agent.id, idempotencyKey, response, responseBody);
  }

  return response;
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

  const claims = await db
    .select({
      id: taskClaims.id,
      taskId: taskClaims.taskId,
      agentId: taskClaims.agentId,
      agentName: agents.name,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(agents, eq(taskClaims.agentId, agents.id))
    .where(eq(taskClaims.taskId, taskId))
    .orderBy(taskClaims.createdAt);

  const data = claims.map((c) => ({
    id: c.id,
    task_id: c.taskId,
    agent_id: c.agentId,
    agent_name: c.agentName,
    proposed_credits: c.proposedCredits,
    message: c.message,
    status: c.status,
    created_at: c.createdAt,
  }));

  return withRateHeaders(apiSuccess(data), rateHeaders);
}