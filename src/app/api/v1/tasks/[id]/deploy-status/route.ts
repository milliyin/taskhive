// Agent API: GET /api/v1/tasks/[id]/deploy-status — poll Vercel deployment status
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, githubDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDeploymentStatus } from "@/services/vercel-deploy";

function mapVercelState(readyState: string): "deploying" | "ready" | "error" {
  switch (readyState) {
    case "READY":
      return "ready";
    case "ERROR":
    case "CANCELED":
      return "error";
    default:
      return "deploying";
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse available tasks");
  }

  // Find latest deliverable with github delivery
  const latestDeliverable = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestDeliverable) {
    return apiError(404, "NO_DELIVERABLE", "No deliverable found for this task", "Submit a deliverable first");
  }

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, latestDeliverable.id))
    .then((r) => r[0]);

  if (!ghDelivery) {
    return apiError(404, "NO_GITHUB_DELIVERY", "No GitHub delivery found for this task", "The latest deliverable is not a GitHub deployment");
  }

  // If already terminal, return cached
  if (ghDelivery.deployStatus === "ready" || ghDelivery.deployStatus === "error") {
    return withRateHeaders(apiSuccess({
      deploy_status: ghDelivery.deployStatus,
      preview_url: ghDelivery.previewUrl,
      error_message: ghDelivery.errorMessage,
    }), rateHeaders);
  }

  // Poll Vercel
  if (!ghDelivery.vercelDeploymentId) {
    return withRateHeaders(apiSuccess({
      deploy_status: ghDelivery.deployStatus,
      preview_url: null,
      error_message: null,
    }), rateHeaders);
  }

  try {
    const result = await getDeploymentStatus(ghDelivery.vercelDeploymentId);
    const newStatus = mapVercelState(result.readyState);

    if (newStatus !== ghDelivery.deployStatus) {
      await db.update(githubDeliveries).set({
        deployStatus: newStatus,
        previewUrl: result.url || ghDelivery.previewUrl,
        errorMessage: newStatus === "error" ? `Deployment ${result.readyState.toLowerCase()}` : null,
        updatedAt: new Date(),
      }).where(eq(githubDeliveries.id, ghDelivery.id));
    }

    return withRateHeaders(apiSuccess({
      deploy_status: newStatus,
      preview_url: result.url || ghDelivery.previewUrl,
      error_message: newStatus === "error" ? `Deployment ${result.readyState.toLowerCase()}` : null,
    }), rateHeaders);
  } catch (err) {
    return withRateHeaders(apiSuccess({
      deploy_status: ghDelivery.deployStatus,
      preview_url: ghDelivery.previewUrl,
      error_message: err instanceof Error ? err.message : "Failed to check status",
    }), rateHeaders);
  }
}
