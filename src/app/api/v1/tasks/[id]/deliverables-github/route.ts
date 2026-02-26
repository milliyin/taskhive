// Agent API: POST /api/v1/tasks/[id]/deliverables-github — submit GitHub repo as deliverable
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import { parseBody, submitGitHubDeliveryV1Schema } from "@/lib/schemas";
import db from "@/db/index";
import { tasks, deliverables, githubDeliveries, webhooks } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { logActivity } from "@/lib/activity-logger";
import { parseGitHubUrl, validateRepoExists, validateRepoDeployable } from "@/services/github-utils";
import { encryptEnvVars } from "@/services/env-parser";
import { createGitDeployment, deleteDeployment } from "@/services/vercel-deploy";

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
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  // Only the claimed agent can deliver
  if (task.claimedByAgentId !== agent.id) {
    return apiError(403, "NOT_CLAIMED_BY_YOU",
      `Task ${taskId} is not claimed by your agent`,
      "You can only submit deliverables to tasks your agent has claimed"
    );
  }

  if (!["claimed", "in_progress"].includes(task.status)) {
    return apiError(409, "INVALID_STATUS",
      `Task ${taskId} is not in a deliverable state (status: ${task.status})`,
      task.status === "delivered"
        ? "A deliverable is already submitted and awaiting review"
        : `Claim the task first with POST /api/v1/tasks/${taskId}/claims`
    );
  }

  // Parse body
  const body = await request.json();
  const parsed = parseBody(submitGitHubDeliveryV1Schema, body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", parsed.error,
      "Required: repo_url (GitHub URL). Optional: branch (string), env_vars (object of key-value pairs)"
    );
  }
  const { repo_url, branch, env_vars } = parsed.data;

  // Check revision count
  const existingCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));
  const revisionNumber = (existingCount[0]?.count || 0) + 1;
  const maxDeliveries = task.maxRevisions + 1;
  if (revisionNumber > maxDeliveries) {
    return apiError(409, "MAX_REVISIONS",
      `Maximum revisions reached (${revisionNumber - 1} of ${maxDeliveries} deliveries)`,
      "All revision attempts used"
    );
  }

  // Concurrent delivery guard
  const pendingDeliverable = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.taskId, taskId), eq(deliverables.status, "submitted")));
  if (pendingDeliverable.length > 0) {
    return apiError(409, "DELIVERY_PENDING",
      "A deliverable is already submitted and awaiting review",
      "Wait for the poster to accept or request a revision"
    );
  }

  // Validate GitHub URL
  const ghParsed = parseGitHubUrl(repo_url);
  if (!ghParsed) {
    return apiError(422, "INVALID_GITHUB_URL",
      "Invalid GitHub URL format",
      "Provide a valid GitHub URL like https://github.com/owner/repo"
    );
  }

  // Check repo exists and is public
  const exists = await validateRepoExists(ghParsed.owner, ghParsed.repo);
  if (!exists) {
    return apiError(422, "REPO_NOT_FOUND",
      "Repository not found or not public",
      "Only public GitHub repos are supported. Verify the URL is correct and the repo is public"
    );
  }

  // Check repo is web-deployable
  const deployCheck = await validateRepoDeployable(ghParsed.owner, ghParsed.repo, branch);
  if (!deployCheck.deployable) {
    return apiError(422, "NOT_DEPLOYABLE",
      deployCheck.reason || "Repository is not a web project",
      "The repo must contain package.json (Node.js) or index.html (static site) to be deployed as a preview"
    );
  }

  // Encrypt env vars if provided
  let envVarsEncryptedStr: string | null = null;
  if (env_vars && Object.keys(env_vars).length > 0) {
    envVarsEncryptedStr = encryptEnvVars(env_vars);
  }

  // Delete old Vercel deployments for this task (best-effort)
  const oldDeliverableIds = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .then((rows) => rows.map((r) => r.id));
  if (oldDeliverableIds.length > 0) {
    const oldGhDeliveries = await db
      .select({ vercelDeploymentId: githubDeliveries.vercelDeploymentId })
      .from(githubDeliveries)
      .where(inArray(githubDeliveries.deliverableId, oldDeliverableIds));
    await Promise.allSettled(
      oldGhDeliveries
        .filter((g) => g.vercelDeploymentId)
        .map((g) => deleteDeployment(g.vercelDeploymentId!))
    );
  }

  // Check deadline
  let isLate = false;
  if (task.deadline && new Date() > new Date(task.deadline)) {
    isLate = true;
  }

  // Create deliverable record
  const [d] = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: `GitHub repo: ${repo_url}${branch ? ` (branch: ${branch})` : ""}`,
      revisionNumber,
    })
    .returning();

  // Create github_deliveries record
  const [ghDelivery] = await db
    .insert(githubDeliveries)
    .values({
      deliverableId: d.id,
      sourceRepoUrl: repo_url,
      sourceBranch: branch || null,
      deployStatus: "pending",
      envVarsEncrypted: envVarsEncryptedStr,
    })
    .returning();

  // Update task status
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  // Deploy to Vercel
  try {
    const result = await createGitDeployment(
      ghParsed.owner,
      ghParsed.repo,
      branch || "main",
      env_vars && Object.keys(env_vars).length > 0 ? env_vars : undefined
    );

    await db.update(githubDeliveries).set({
      vercelDeploymentId: result.id,
      previewUrl: result.url,
      deployStatus: "deploying",
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    const data = {
      id: d.id,
      task_id: d.taskId,
      agent_id: d.agentId,
      content: d.content,
      status: d.status,
      revision_number: d.revisionNumber,
      submitted_at: d.submittedAt,
      is_late: isLate,
      github: {
        preview_url: result.url,
        deploy_status: "deploying",
        source_repo_url: repo_url,
        source_branch: branch || "main",
      },
    };

    logActivity(agent.id, "deliverable_submitted",
      `Submitted GitHub delivery for task #${taskId} (revision ${revisionNumber}): ${repo_url}`,
      { taskId, deliverableId: d.id, type: "github", repoUrl: repo_url }
    );

    // Fire webhook
    const agentsWithHooks = await db
      .select({ agentId: webhooks.agentId })
      .from(webhooks)
      .where(eq(webhooks.isActive, true))
      .groupBy(webhooks.agentId);

    await Promise.allSettled(
      agentsWithHooks.map(({ agentId }) =>
        dispatchWebhook(agentId, "deliverable.submitted", {
          task_id: taskId,
          deliverable_id: d.id,
          task_title: task.title,
          revision_number: d.revisionNumber,
          type: "github",
          preview_url: result.url,
        })
      )
    );

    const meta: Record<string, unknown> = {};
    if (isLate) {
      meta.warning = "This deliverable was submitted after the task deadline.";
    }

    return withRateHeaders(apiSuccess(data, meta, 201), rateHeaders);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Deployment failed";

    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    // Revert task status + mark deliverable rejected
    await db.update(tasks).set({ status: task.status, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await db.update(deliverables).set({
      status: "rejected",
      revisionNotes: `Deploy failed: ${errorMessage}`,
    }).where(eq(deliverables.id, d.id));

    return withRateHeaders(
      apiError(500, "DEPLOY_FAILED", `Vercel deployment failed: ${errorMessage}`,
        "Check that the repo URL is correct, the repo is public, and has a valid build configuration"
      ),
      rateHeaders
    );
  }
}
