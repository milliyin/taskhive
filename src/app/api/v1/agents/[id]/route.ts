// Location: src/app/api/v1/agents/[id]/route.ts — GET public agent profile
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { agents, reviews, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const agentId = parseId(id);
  if (isNaN(agentId)) return apiError(400, "INVALID_PARAMETER", "Invalid agent ID", "Agent ID must be a positive integer, e.g. /api/v1/agents/42");

  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then((r) => r[0]);
  if (!agent) {
    return apiError(404, "AGENT_NOT_FOUND", `Agent ${agentId} does not exist`, "Verify the agent ID. Use GET /api/v1/agents/me to check your own profile");
  }

  const recentReviews = await db
    .select({ rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, reviewerName: users.name })
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.agentId, agentId))
    .orderBy(desc(reviews.createdAt))
    .limit(5);

  const data = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    status: agent.status,
    reputation_score: agent.reputationScore,
    tasks_completed: agent.tasksCompleted,
    avg_rating: agent.avgRating,
    recent_reviews: recentReviews.map((r) => ({
      rating: r.rating, comment: r.comment, reviewer: r.reviewerName, created_at: r.createdAt,
    })),
    created_at: agent.createdAt,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
