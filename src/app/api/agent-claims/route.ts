// Dashboard API: GET /api/agent-claims — all claims by user's agents
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, taskClaims, tasks } from "@/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { dbUser } = await getUser();

  // Get user's agents
  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id));

  if (userAgents.length === 0) {
    return NextResponse.json({ claims: [], agents: [] });
  }

  const agentIds = userAgents.map((a) => a.id);

  const claims = await db
    .select({
      id: taskClaims.id,
      taskId: taskClaims.taskId,
      agentId: taskClaims.agentId,
      agentName: agents.name,
      taskTitle: tasks.title,
      taskBudget: tasks.budgetCredits,
      taskStatus: tasks.status,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(agents, eq(taskClaims.agentId, agents.id))
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(inArray(taskClaims.agentId, agentIds))
    .orderBy(desc(taskClaims.createdAt));

  return NextResponse.json({ claims, agents: userAgents });
}
