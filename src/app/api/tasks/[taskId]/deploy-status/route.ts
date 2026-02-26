// Dashboard API: GET /api/tasks/[taskId]/deploy-status — poll Vercel for deployment status
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, deliverables, githubDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDeploymentStatus } from "@/services/vercel-deploy";

// Map Vercel readyState to our deploy_status enum
function mapVercelState(readyState: string): "deploying" | "ready" | "error" {
  switch (readyState) {
    case "READY":
      return "ready";
    case "ERROR":
    case "CANCELED":
      return "error";
    default:
      // QUEUED, BUILDING, INITIALIZING, etc.
      return "deploying";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId))
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Find latest deliverable with a github delivery
  const latestDeliverable = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestDeliverable) {
    return NextResponse.json({ error: "No deliverable found" }, { status: 404 });
  }

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, latestDeliverable.id))
    .then((r) => r[0]);

  if (!ghDelivery) {
    return NextResponse.json({ error: "No GitHub delivery found" }, { status: 404 });
  }

  // If already terminal state, just return it
  if (ghDelivery.deployStatus === "ready" || ghDelivery.deployStatus === "error") {
    return NextResponse.json({
      deployStatus: ghDelivery.deployStatus,
      previewUrl: ghDelivery.previewUrl,
      errorMessage: ghDelivery.errorMessage,
    });
  }

  // Poll Vercel if we have a deployment ID
  if (!ghDelivery.vercelDeploymentId) {
    return NextResponse.json({
      deployStatus: ghDelivery.deployStatus,
      previewUrl: null,
      errorMessage: null,
    });
  }

  try {
    const result = await getDeploymentStatus(ghDelivery.vercelDeploymentId);
    const newStatus = mapVercelState(result.readyState);

    // Update DB if status changed
    if (newStatus !== ghDelivery.deployStatus) {
      await db.update(githubDeliveries).set({
        deployStatus: newStatus,
        previewUrl: result.url || ghDelivery.previewUrl,
        errorMessage: newStatus === "error" ? `Deployment ${result.readyState.toLowerCase()}` : null,
        updatedAt: new Date(),
      }).where(eq(githubDeliveries.id, ghDelivery.id));
    }

    return NextResponse.json({
      deployStatus: newStatus,
      previewUrl: result.url || ghDelivery.previewUrl,
      errorMessage: newStatus === "error" ? `Deployment ${result.readyState.toLowerCase()}` : null,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to check status";

    // Mark as error so the client stops polling
    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return NextResponse.json({
      deployStatus: "error",
      previewUrl: ghDelivery.previewUrl,
      errorMessage,
    });
  }
}
