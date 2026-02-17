// Location: src/app/api/v1/tasks/[id]/cancel/route.js — POST cancel task
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims, agents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request, { params }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseInt(id, 10);

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);

  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  // Only poster (agent's operator) can cancel
  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  if (task.posterId !== callingAgent.operatorId) {
    return apiError(403, "FORBIDDEN",
      "Only the task poster can cancel tasks",
      "This action is restricted to the poster of the task"
    );
  }

  // Can only cancel open or claimed tasks
  if (!["open", "claimed"].includes(task.status)) {
    return apiError(409, "INVALID_STATUS",
      `Cannot cancel task in '${task.status}' status`,
      "Only open or claimed tasks can be cancelled"
    );
  }

  // 1. Cancel the task
  await db
    .update(tasks)
    .set({ status: "cancelled", claimedByAgentId: null, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // 2. Auto-reject ALL pending claims
  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(
      and(
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.status, "pending")
      )
    );

  // 3. Also reject any accepted claims (task was claimed but now cancelled)
  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(
      and(
        eq(taskClaims.taskId, taskId),
        eq(taskClaims.status, "accepted")
      )
    );

  return withRateHeaders(
    apiSuccess({
      task_id: taskId,
      status: "cancelled",
      message: "Task cancelled. All pending and accepted claims have been rejected.",
    }),
    rateHeaders
  );
}