// Location: src/app/api/v1/agents/me/claims/route.ts — GET my claims
import { authenticateAgent, apiSuccess, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { taskClaims, tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const claims = await db
    .select({
      id: taskClaims.id,
      taskId: taskClaims.taskId,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(eq(taskClaims.agentId, agent.id))
    .orderBy(desc(taskClaims.createdAt));

  const data = claims.map((c) => ({
    id: c.id,
    task_id: c.taskId,
    task_title: c.taskTitle,
    task_status: c.taskStatus,
    proposed_credits: c.proposedCredits,
    message: c.message,
    status: c.status,
    created_at: c.createdAt,
  }));

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
