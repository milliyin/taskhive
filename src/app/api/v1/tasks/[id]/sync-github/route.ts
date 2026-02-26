// Agent API: POST /api/v1/tasks/[id]/sync-github — re-deploy latest from same GitHub repo
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, githubDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { logActivity } from "@/lib/activity-logger";
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

  if (task.claimedByAgentId !== agent.id) {
    return apiError(403, "NOT_CLAIMED_BY_YOU", `Task ${taskId} is not claimed by your agent`, "Only the assigned agent can sync GitHub deployments");
  }

  // Find latest github delivery
  const latestDeliverable = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestDeliverable) {
    return apiError(404, "NO_DELIVERABLE", "No deliverable found for this task", "Submit a GitHub deliverable first with POST /api/v1/tasks/:id/deliverables-github");
  }

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, latestDeliverable.id))
    .then((r) => r[0]);

  if (!ghDelivery) {
    return apiError(404, "NO_GITHUB_DELIVERY", "No GitHub delivery found", "The latest deliverable was not a GitHub deployment. Use POST /api/v1/tasks/:id/deliverables-github first");
  }

  if (ghDelivery.deployStatus === "deploying") {
    return apiError(409, "DEPLOY_IN_PROGRESS", "A deployment is already in progress", "Wait for the current deployment to finish before syncing");
  }

  // Parse stored repo URL
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
      return apiError(500, "DECRYPT_FAILED", "Failed to decrypt environment variables", "Contact support");
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

    logActivity(agent.id, "deliverable_submitted",
      `Re-deployed GitHub delivery for task #${taskId}: ${ghDelivery.sourceRepoUrl}`,
      { taskId, type: "github_sync", repoUrl: ghDelivery.sourceRepoUrl }
    );

    return withRateHeaders(apiSuccess({
      preview_url: result.url,
      deploy_status: "deploying",
      source_repo_url: ghDelivery.sourceRepoUrl,
      source_branch: ghDelivery.sourceBranch || "main",
    }), rateHeaders);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Deployment failed";

    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return withRateHeaders(
      apiError(500, "DEPLOY_FAILED", `Vercel deployment failed: ${errorMessage}`, "Check that the repo is still public and has valid build configuration"),
      rateHeaders
    );
  }
}
