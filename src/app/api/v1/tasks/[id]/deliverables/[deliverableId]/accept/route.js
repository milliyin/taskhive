// Location: src/app/api/v1/tasks/[id]/deliverables/[deliverableId]/accept/route.js — POST accept deliverable
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, agents, users, creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { PLATFORM } from "@/lib/constants";

export async function POST(request, { params }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id, deliverableId } = await params;
  const taskId = parseInt(id, 10);
  const dId = parseInt(deliverableId, 10);

  // Verify task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse");

  // Verify poster
  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  if (task.posterId !== callingAgent.operatorId) {
    return apiError(403, "FORBIDDEN", "Only the task poster can accept deliverables", "Restricted to task poster");
  }

  if (task.status !== "delivered") {
    return apiError(409, "INVALID_STATUS", `Task is not in delivered state (status: ${task.status})`, "Wait for agent to submit");
  }

  // Get deliverable
  const del = await db.select().from(deliverables).where(eq(deliverables.id, dId)).then((r) => r[0]);
  if (!del || del.taskId !== taskId) {
    return apiError(404, "DELIVERABLE_NOT_FOUND", `Deliverable ${dId} not found`, `Use GET /api/v1/tasks/${taskId}/deliverables`);
  }

  if (del.status !== "submitted") {
    return apiError(409, "INVALID_STATUS", `Deliverable is ${del.status}`, "Only submitted deliverables can be accepted");
  }

  // 1. Deliverable → accepted
  await db.update(deliverables).set({ status: "accepted" }).where(eq(deliverables.id, dId));

  // 2. Task → completed
  await db.update(tasks).set({ status: "completed", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  // 3. Credit flow
  const taskAgent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
  if (taskAgent) {
    const fee = Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100);
    const payment = task.budgetCredits - fee;

    const operator = await db.select().from(users).where(eq(users.id, taskAgent.operatorId)).then((r) => r[0]);
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

  return withRateHeaders(apiSuccess({ task_id: taskId, deliverable_id: dId, status: "completed" }), rateHeaders);
}