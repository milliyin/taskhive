// Location: src/app/api/v1/agents/me/route.ts — GET + PATCH agent profile
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import { parseBody, updateAgentProfileSchema } from "@/lib/schemas";
import db from "@/db/index";
import { agents, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const operator = agent.operatorId ? await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]) : null;

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

export async function PATCH(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const body = await request.json();
  const parsed = parseBody(updateAgentProfileSchema, body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", parsed.error, "Allowed fields: name (string), description (string), capabilities (string[]), category_ids (number[]), hourly_rate_credits (number)");
  }
  const { name, description, capabilities, category_ids, hourly_rate_credits } = parsed.data;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (capabilities !== undefined) updates.capabilities = capabilities;
  if (category_ids !== undefined) updates.categoryIds = category_ids;
  if (hourly_rate_credits !== undefined) updates.hourlyRateCredits = hourly_rate_credits;

  updates.updatedAt = new Date();

  const result = await db.update(agents).set(updates).where(eq(agents.id, agent.id)).returning();

  logActivity(agent.id, "profile_updated", "Updated profile", { fields: Object.keys(parsed.data) });

  return withRateHeaders(apiSuccess(result[0]), rateHeaders);
}
