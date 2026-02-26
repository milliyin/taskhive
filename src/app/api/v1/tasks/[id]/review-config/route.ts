// Location: src/app/api/v1/tasks/[id]/review-config/route.ts — GET decrypted LLM keys for reviewer agent
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId, isReviewerAgent } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, agents, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Fetch task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Verify the task ID. Use GET /api/v1/tasks to browse available tasks");
  }

  // Access: poster's agent, claimed agent, or designated reviewer agent
  if (!isReviewerAgent(agent.id)) {
    const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
    const isPoster = task.posterId === callingAgent!.operatorId;
    const isClaimed = task.claimedByAgentId === agent.id;

    if (!isPoster && !isClaimed) {
      return apiError(403, "FORBIDDEN",
        "Only the task poster's agent, claimed agent, or reviewer agent can access review config",
        "Your agent must be the poster's agent, the claimed agent, or the designated reviewer agent (REVIEWER_AGENT_ID)"
      );
    }
  }

  // ─── Poster key: read from user profile ────────────────────────
  let posterLlmKey: string | null = null;
  let posterLlmProvider: string | null = null;

  const poster = await db.select().from(users).where(eq(users.id, task.posterId)).then((r) => r[0]);
  const posterKeyAvailable = !!poster?.llmKeyEncrypted;
  const posterUnderLimit = task.posterMaxReviews === null || task.posterReviewsUsed < (task.posterMaxReviews ?? 0);
  const posterKeyUsable = posterKeyAvailable && posterUnderLimit;

  if (posterKeyUsable && poster?.llmKeyEncrypted) {
    try {
      posterLlmKey = decrypt(poster.llmKeyEncrypted);
      posterLlmProvider = poster.llmProvider;
    } catch {
      posterLlmKey = null;
    }
  }

  // ─── Freelancer key: always available if set ──────────────────
  let freelancerLlmKey: string | null = null;
  let freelancerLlmProvider: string | null = null;

  if (task.claimedByAgentId) {
    const claimedAgent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
    if (claimedAgent?.freelancerLlmKeyEncrypted) {
      try {
        freelancerLlmKey = decrypt(claimedAgent.freelancerLlmKeyEncrypted);
        freelancerLlmProvider = claimedAgent.freelancerLlmProvider;
      } catch {
        freelancerLlmKey = null;
      }
    }
  }

  const data = {
    auto_review_enabled: task.autoReviewEnabled,
    // Poster key info (from user profile)
    poster_llm_key: posterLlmKey,
    poster_llm_provider: posterLlmProvider,
    poster_max_reviews: task.posterMaxReviews,
    poster_reviews_used: task.posterReviewsUsed,
    poster_key_usable: posterKeyUsable,
    poster_limit_reached: posterKeyAvailable && !posterUnderLimit,
    // Freelancer key info
    freelancer_llm_key: freelancerLlmKey,
    freelancer_llm_provider: freelancerLlmProvider,
    freelancer_key_available: !!freelancerLlmKey,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
