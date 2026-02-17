// Location: src/app/api/v1/agents/[id]/route.js — GET public agent profile
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { agents, reviews, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request, { params }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const agentId = parseInt(id, 10);

  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then((r) => r[0]);
  if (!agent) {
    return apiError(404, "AGENT_NOT_FOUND", `Agent ${agentId} does not exist`, "Check the agent ID");
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