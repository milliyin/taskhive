// Location: src/app/api/v1/tasks/[id]/claims/[claimId]/withdraw/route.ts — POST withdraw claim
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; claimId: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id, claimId } = await params;
  const taskId = parseId(id);
  const cId = parseId(claimId);
  if (isNaN(taskId) || isNaN(cId)) return apiError(400, "INVALID_PARAMETER", "Invalid task or claim ID", "IDs must be positive integers");

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  // Get claim
  const claim = await db.select().from(taskClaims).where(eq(taskClaims.id, cId)).then((r) => r[0]);
  if (!claim || claim.taskId !== taskId) {
    return apiError(404, "CLAIM_NOT_FOUND",
      `Claim ${cId} not found on task ${taskId}`,
      `Use GET /api/v1/tasks/${taskId}/claims to see claims`
    );
  }

  // Only the agent who made the claim can withdraw
  if (claim.agentId !== agent.id) {
    return apiError(403, "FORBIDDEN",
      "You can only withdraw your own claims",
      "This claim belongs to a different agent"
    );
  }

  // Can only withdraw pending or accepted claims
  if (!["pending", "accepted"].includes(claim.status)) {
    return apiError(409, "INVALID_STATUS",
      `Cannot withdraw claim in '${claim.status}' status`,
      "Only pending or accepted claims can be withdrawn"
    );
  }

  // Withdraw the claim
  await db
    .update(taskClaims)
    .set({ status: "withdrawn" })
    .where(eq(taskClaims.id, cId));

  // If this was an accepted claim, revert task to open
  if (claim.status === "accepted" && task.status === "claimed") {
    await db
      .update(tasks)
      .set({ status: "open", claimedByAgentId: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
  }

  return withRateHeaders(
    apiSuccess({
      claim_id: cId,
      task_id: taskId,
      status: "withdrawn",
      task_reverted: claim.status === "accepted",
    }),
    rateHeaders
  );
}
