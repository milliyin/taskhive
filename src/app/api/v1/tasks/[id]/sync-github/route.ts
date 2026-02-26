// Agent API: POST /api/v1/tasks/[id]/sync-github — re-deploy from same GitHub repo
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, githubDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseGitHubUrl } from "@/services/github-utils";
import { decryptEnvVars } from "@/services/env-parser";
import { createGitDeployment } from "@/services/vercel-deploy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse available tasks");
  }

  // Only the claimed agent can sync
  if (task.claimedByAgentId !== agent.id) {
    return apiError(403, "NOT_CLAIMED_BY_YOU", `Task ${taskId} is not claimed by your agent`, "You can only sync deployments for tasks your agent has claimed");
  }

  // Find latest deliverable with a github delivery
  const latestDeliverable = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestDeliverable) {
    return apiError(404, "NO_DELIVERABLE", "No deliverable found for this task", "Submit a deliverable first with POST /api/v1/tasks/:id/deliverables-github");
  }

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, latestDeliverable.id))
    .then((r) => r[0]);

  if (!ghDelivery) {
    return apiError(404, "NO_GITHUB_DELIVERY", "No GitHub delivery found", "Submit a GitHub delivery first");
  }

  if (ghDelivery.deployStatus === "skipped") {
    return apiError(409, "NOT_DEPLOYABLE", "This repository was not deployed (not a web project)", "Only web projects with package.json or index.html can be deployed");
  }

  if (ghDelivery.deployStatus === "deploying") {
    return apiError(409, "ALREADY_DEPLOYING", "A deployment is already in progress", "Wait for the current deployment to finish, then try again");
  }

  // Parse repo URL
  const ghParsed = parseGitHubUrl(ghDelivery.sourceRepoUrl);
  if (!ghParsed) {
    return apiError(500, "INTERNAL_ERROR", "Invalid stored GitHub URL", "Contact support");
  }

  // Decrypt stored env vars
  let envVars: Record<string, string> | undefined;
  if (ghDelivery.envVarsEncrypted) {
    try {
      envVars = decryptEnvVars(ghDelivery.envVarsEncrypted);
    } catch {
      return apiError(500, "DECRYPT_FAILED", "Failed to decrypt environment variables", "Re-submit the delivery with fresh env_vars");
    }
  }

  // Deploy
  try {
    const result = await createGitDeployment(
      ghParsed.owner,
      ghParsed.repo,
      ghDelivery.sourceBranch || "main",
      envVars && Object.keys(envVars).length > 0 ? envVars : undefined
    );

    await db.update(githubDeliveries).set({
      vercelDeploymentId: result.id,
      previewUrl: result.url,
      deployStatus: "deploying",
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return withRateHeaders(apiSuccess({
      preview_url: result.url,
      deploy_status: "deploying",
    }), rateHeaders);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Deployment failed";

    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return withRateHeaders(apiError(500, "DEPLOY_FAILED", errorMessage, "Check the repository and try again"), rateHeaders);
  }
}
