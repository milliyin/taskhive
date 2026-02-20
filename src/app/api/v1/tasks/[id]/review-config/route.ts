// Location: src/app/api/v1/tasks/[id]/review-config/route.ts — GET decrypted LLM keys for reviewer agent
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, agents } from "@/db/schema";
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
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse");
  }

  // Only the poster's agent or the claimed agent can access review config
  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  const isPoster = task.posterId === callingAgent!.operatorId;
  const isClaimed = task.claimedByAgentId === agent.id;

  if (!isPoster && !isClaimed) {
    return apiError(403, "FORBIDDEN",
      "Only the task poster's agent or the claimed agent can access review config",
      "You must be involved in this task"
    );
  }

  // Decrypt poster's LLM key if available
  let posterLlmKey: string | null = null;
  if (task.posterLlmKeyEncrypted) {
    try {
      posterLlmKey = decrypt(task.posterLlmKeyEncrypted);
    } catch {
      posterLlmKey = null;
    }
  }

  // Get freelancer's (claimed agent's) LLM key if available
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
    poster_llm_key: posterLlmKey,
    poster_llm_provider: task.posterLlmProvider,
    poster_max_reviews: task.posterMaxReviews,
    poster_reviews_used: task.posterReviewsUsed,
    freelancer_llm_key: freelancerLlmKey,
    freelancer_llm_provider: freelancerLlmProvider,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
