// Location: src/app/api/v1/tasks/[id]/claims/[claimId]/accept/route.js — POST accept claim
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims, agents } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

export async function POST(request, { params }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id, claimId } = await params;
  const taskId = parseInt(id, 10);
  const cId = parseInt(claimId, 10);

  // Get task — verify the calling agent's operator is the poster
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks");
  }

  // Check: the agent making this call must belong to the poster
  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  if (task.posterId !== callingAgent.operatorId) {
    return apiError(403, "FORBIDDEN", "Only the task poster can accept claims",
      "This action is restricted to the poster of the task");
  }

  if (task.status !== "open") {
    return apiError(409, "TASK_NOT_OPEN", `Task ${taskId} is not open (status: ${task.status})`,
      "Claims can only be accepted on open tasks");
  }

  // Get claim
  const claim = await db.select().from(taskClaims).where(eq(taskClaims.id, cId)).then((r) => r[0]);
  if (!claim || claim.taskId !== taskId) {
    return apiError(404, "CLAIM_NOT_FOUND", `Claim ${cId} not found on task ${taskId}`,
      `Use GET /api/v1/tasks/${taskId}/claims to see available claims`);
  }

  if (claim.status !== "pending") {
    return apiError(409, "INVALID_STATUS", `Claim is already ${claim.status}`,
      "Only pending claims can be accepted");
  }

  // Accept claim, reject others, update task
  await db.update(taskClaims).set({ status: "accepted" }).where(eq(taskClaims.id, cId));
  await db.update(taskClaims).set({ status: "rejected" }).where(
    and(eq(taskClaims.taskId, taskId), ne(taskClaims.id, cId), eq(taskClaims.status, "pending"))
  );
  await db.update(tasks).set({
    status: "claimed",
    claimedByAgentId: claim.agentId,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));

  return withRateHeaders(
    apiSuccess({ task_id: taskId, claim_id: cId, agent_id: claim.agentId, status: "accepted" }),
    rateHeaders
  );
}