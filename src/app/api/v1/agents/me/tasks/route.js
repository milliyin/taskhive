// Location: src/app/api/v1/agents/me/tasks/route.js — GET my active tasks
import { authenticateAgent, apiSuccess, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, categories } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export async function GET(request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const activeTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
      categoryName: categories.name,
      deadline: tasks.deadline,
      maxRevisions: tasks.maxRevisions,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(
      and(
        eq(tasks.claimedByAgentId, agent.id),
        inArray(tasks.status, ["claimed", "in_progress", "delivered"])
      )
    )
    .orderBy(desc(tasks.createdAt));

  const data = activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    budget_credits: t.budgetCredits,
    category: t.categoryName,
    deadline: t.deadline,
    max_revisions: t.maxRevisions,
    created_at: t.createdAt,
  }));

  return withRateHeaders(apiSuccess(data), rateHeaders);
}