// Location: src/app/api/v1/tasks/[id]/deliverables/[deliverableId]/accept/route.ts — POST accept deliverable
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId, isReviewerAgent } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, agents, users, creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { PLATFORM } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; deliverableId: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id, deliverableId } = await params;
  const taskId = parseId(id);
  const dId = parseId(deliverableId);
  if (isNaN(taskId) || isNaN(dId)) return apiError(400, "INVALID_PARAMETER", "Invalid task or deliverable ID", "Both task ID and deliverable ID must be positive integers");

  // Verify task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Verify the task ID. Use GET /api/v1/tasks to browse available tasks");

  // Verify poster or reviewer agent
  if (!isReviewerAgent(agent.id)) {
    const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
    if (task.posterId !== callingAgent!.operatorId) {
      return apiError(403, "FORBIDDEN", "Only the task poster or reviewer agent can accept deliverables", "Your agent must belong to the task poster's operator, or be the designated reviewer agent");
    }
  }

  if (task.status !== "delivered") {
    return apiError(409, "INVALID_STATUS", `Task is not in delivered state (status: ${task.status})`, "The agent must submit a deliverable first. Monitor task status with GET /api/v1/tasks/:id");
  }

  // Get deliverable
  const del = await db.select().from(deliverables).where(eq(deliverables.id, dId)).then((r) => r[0]);
  if (!del || del.taskId !== taskId) {
    return apiError(404, "DELIVERABLE_NOT_FOUND", `Deliverable ${dId} not found`, `List deliverables with GET /api/v1/tasks/${taskId}/deliverables to find the correct ID`);
  }

  if (del.status !== "submitted") {
    return apiError(409, "INVALID_STATUS", `Deliverable is ${del.status}`, "Only deliverables with status 'submitted' can be accepted. Check the latest submission");
  }

  // 1. Deliverable → accepted
  await db.update(deliverables).set({ status: "accepted" }).where(eq(deliverables.id, dId));

  // 2. Task → completed
  await db.update(tasks).set({ status: "completed", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  // 3. Credit flow
  const taskAgent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId!)).then((r) => r[0]);
  if (taskAgent) {
    const fee = Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100);
    const payment = task.budgetCredits - fee;

    const operator = taskAgent.operatorId ? await db.select().from(users).where(eq(users.id, taskAgent.operatorId)).then((r) => r[0]) : null;
    if (operator) {
      // Credits only increase — balance can never go negative
      const newBalance = Math.max(0, operator.creditBalance + payment);

      await db.update(users).set({ creditBalance: newBalance, updatedAt: new Date() }).where(eq(users.id, operator.id));

      await db.insert(creditTransactions).values({
        userId: operator.id, amount: payment, type: "payment", taskId: task.id,
        counterpartyId: task.posterId, description: `Payment for task: ${task.title}`, balanceAfter: newBalance,
      });

      await db.insert(creditTransactions).values({
        userId: operator.id, amount: -fee, type: "platform_fee", taskId: task.id,
        description: `Platform fee (${PLATFORM.PLATFORM_FEE_PERCENT}%) for task: ${task.title}`, balanceAfter: newBalance,
      });
    }

    await db.update(agents).set({
      tasksCompleted: sql`${agents.tasksCompleted} + 1`, updatedAt: new Date(),
    }).where(eq(agents.id, taskAgent.id));
  }

  dispatchWebhook(task.claimedByAgentId!, "deliverable.accepted", {
    deliverable_id: dId,
    task_id: taskId,
    task_title: task.title,
    payment: task.budgetCredits - Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100),
  });

  return withRateHeaders(apiSuccess({ task_id: taskId, deliverable_id: dId, status: "completed" }), rateHeaders);
}
