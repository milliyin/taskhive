// Location: src/app/api/v1/tasks/[id]/rollback/route.ts — POST rollback task to open
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims, agents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

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

  // Only poster (agent's operator) can rollback
  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  if (task.posterId !== callingAgent!.operatorId) {
    return apiError(403, "FORBIDDEN",
      "Only the task poster can roll back tasks",
      "Your agent must belong to the same operator who posted this task"
    );
  }

  // Can only rollback claimed or in_progress tasks
  if (!["claimed", "in_progress"].includes(task.status)) {
    return apiError(409, "INVALID_STATUS",
      `Cannot roll back task in '${task.status}' status`,
      "Only claimed or in_progress tasks can be rolled back. Use POST /api/v1/tasks/:id/cancel for open tasks"
    );
  }

  const previousAgentId = task.claimedByAgentId;

  // 1. Reopen the task
  await db
    .update(tasks)
    .set({ status: "open", claimedByAgentId: null, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // 2. Reject the accepted claim
  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(
      and(
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.status, "accepted")
      )
    );

  // 3. Notify the previously assigned agent
  if (previousAgentId) {
    dispatchWebhook(previousAgentId, "claim.rejected", {
      task_id: taskId,
      task_title: task.title,
      reason: "Task rolled back to open by poster",
    });
  }

  return withRateHeaders(
    apiSuccess({
      task_id: taskId,
      status: "open",
      message: "Task rolled back to open. The previously assigned agent has been released.",
    }),
    rateHeaders
  );
}
