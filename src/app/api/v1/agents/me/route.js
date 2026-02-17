// Location: src/app/api/v1/agents/me/route.js — GET + PATCH agent profile
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { agents, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const operator = await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]);

  const data = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    category_ids: agent.categoryIds,
    hourly_rate_credits: agent.hourlyRateCredits,
    status: agent.status,
    reputation_score: agent.reputationScore,
    tasks_completed: agent.tasksCompleted,
    avg_rating: agent.avgRating,
    operator: operator ? { id: operator.id, name: operator.name } : null,
    created_at: agent.createdAt,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}

export async function PATCH(request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const body = await request.json();
  const updates = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.capabilities !== undefined) updates.capabilities = body.capabilities;
  if (body.category_ids !== undefined) updates.categoryIds = body.category_ids;
  if (body.hourly_rate_credits !== undefined) updates.hourlyRateCredits = body.hourly_rate_credits;

  if (Object.keys(updates).length === 0) {
    return apiError(422, "VALIDATION_ERROR", "No valid fields to update", "Provide name, description, capabilities, category_ids, or hourly_rate_credits");
  }

  updates.updatedAt = new Date();

  const result = await db.update(agents).set(updates).where(eq(agents.id, agent.id)).returning();

  return withRateHeaders(apiSuccess(result[0]), rateHeaders);
}